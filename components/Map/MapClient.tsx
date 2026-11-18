"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Supercluster from "supercluster";
import type { IssuePinData, IssueFilters, IssueStatus } from "@/types";
import { LayerToggle } from "./LayerToggle";
import { IssueDrawer } from "@/components/Issue/IssueDrawer";
import { Button } from "@/components/ui/button";
import { Plus, Locate, MapPin } from "lucide-react";
import { haversineKm } from "@/lib/geo";

const MapboxMap = dynamic(() => import("./MapboxMap"), { ssr: false });

interface Props {
    initialIssues: IssuePinData[];
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi fallback
const USER_RADIUS_KM = 2;
const CLUSTER_ZOOM_THRESHOLD = 17;

export function MapClient({ initialIssues }: Props) {
    const { data: session } = useSession();
    const router = useRouter();

    const [issues, setIssues] = useState<IssuePinData[]>(initialIssues);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [locationReady, setLocationReady] = useState(false);
    const [viewState, setViewState] = useState(() => {
        try {
            const saved = sessionStorage.getItem("mapViewState");
            if (saved) {
                const parsed = JSON.parse(saved);
                // If we have a saved state that isn't the default, trust it
                if (
                    parsed.latitude !== DEFAULT_CENTER.lat ||
                    parsed.longitude !== DEFAULT_CENTER.lng
                ) {
                    return parsed as typeof DEFAULT_CENTER & { zoom: number };
                }
            }
        } catch {}
        return {
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            zoom: 12,
        };
    });
    const [filters, setFilters] = useState<IssueFilters>({});
    const [showPersonalLayer, setShowPersonalLayer] = useState(false);
    const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get user location on mount — wait for it before showing the map
    useEffect(() => {
        // If we already have a valid viewState from sessionStorage, skip the loading screen
        const hasSavedLocation =
            viewState.latitude !== DEFAULT_CENTER.lat ||
            viewState.longitude !== DEFAULT_CENTER.lng;
        if (hasSavedLocation) {
            setLocationReady(true);
        }

        const timeout = setTimeout(() => {
            // Fallback after 3s if geolocation doesn't resolve
            setLocationReady(true);
        }, 3000);

        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                clearTimeout(timeout);
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                setUserLocation(loc);
                // Only override viewState if we didn't have a saved position
                if (!hasSavedLocation) {
                    const newVs = {
                        latitude: loc.lat,
                        longitude: loc.lng,
                        zoom: 14,
                    };
                    setViewState(newVs);
                    // Re-fetch issues around user's actual location
                    fetchIssues(newVs.latitude, newVs.longitude, newVs.zoom);
                }
                setLocationReady(true);
            },
            () => {
                clearTimeout(timeout);
                setLocationReady(true);
            },
        );

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced issue fetch on map move
    const fetchIssues = useCallback(
        async (lat: number, lng: number, zoom: number) => {
            const radiusKm = zoom > 13 ? 3 : zoom > 11 ? 8 : 20;
            const params = new URLSearchParams({
                lat: lat.toString(),
                lng: lng.toString(),
                radiusKm: radiusKm.toString(),
                ...(showPersonalLayer ? { personal: "true" } : {}),
                ...(filters.status?.length
                    ? { status: filters.status.join(",") }
                    : {}),
                ...(filters.category?.length
                    ? { category: filters.category.join(",") }
                    : {}),
            });

            try {
                const res = await fetch(`/api/issues?${params}`);
                if (!res.ok) return;
                const data = await res.json();
                setIssues(data.issues ?? []);
            } catch {
                // network error — keep showing current issues
            }
        },
        [showPersonalLayer, filters],
    );

    const handleViewStateChange = useCallback(
        (vs: typeof viewState) => {
            setViewState(vs);
            try {
                sessionStorage.setItem("mapViewState", JSON.stringify(vs));
            } catch {}
            if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
            fetchTimerRef.current = setTimeout(() => {
                fetchIssues(vs.latitude, vs.longitude, vs.zoom);
            }, 400);
        },
        [fetchIssues],
    );

    // Re-fetch when filters change
    useEffect(() => {
        fetchIssues(viewState.latitude, viewState.longitude, viewState.zoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, showPersonalLayer]);

    // Live polling — refresh issues every 10 seconds so new reports appear instantly
    useEffect(() => {
        const interval = setInterval(() => {
            fetchIssues(
                viewState.latitude,
                viewState.longitude,
                viewState.zoom,
            );
        }, 10_000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchIssues, viewState.latitude, viewState.longitude, viewState.zoom]);

    // Cluster issues client-side
    const { clusters, supercluster } = useMemo(() => {
        const sc = new Supercluster({
            radius: 60,
            maxZoom: CLUSTER_ZOOM_THRESHOLD,
        });
        const features: GeoJSON.Feature<GeoJSON.Point, IssuePinData>[] =
            issues.map((issue) => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [issue.lng, issue.lat],
                },
                properties: issue,
            }));
        sc.load(features);

        const zoom = Math.floor(viewState.zoom);
        // Use a generous viewport bbox — assume ~4 tiles wide/tall
        const lngRange = (360 / Math.pow(2, zoom)) * 2;
        const latRange = (180 / Math.pow(2, zoom)) * 2;
        const bbox: [number, number, number, number] = [
            viewState.longitude - lngRange,
            Math.max(-85, viewState.latitude - latRange),
            viewState.longitude + lngRange,
            Math.min(85, viewState.latitude + latRange),
        ];
        const clustered = sc.getClusters(bbox, zoom);
        return { clusters: clustered, supercluster: sc };
    }, [issues, viewState.zoom, viewState.latitude, viewState.longitude]);

    // Apply 2km geofence — gray out issues outside user's radius
    const processedClusters = useMemo(() => {
        if (!userLocation) return clusters;
        return clusters.map((c) => {
            const [lng, lat] = c.geometry.coordinates;
            const dist = haversineKm(
                userLocation.lat,
                userLocation.lng,
                lat,
                lng,
            );
            return {
                ...c,
                properties: { ...c.properties, dimmed: dist > USER_RADIUS_KM },
            };
        });
    }, [clusters, userLocation]);

    const handleLocate = () => {
        if (userLocation) {
            setViewState((v) => ({
                ...v,
                latitude: userLocation.lat,
                longitude: userLocation.lng,
                zoom: 15,
            }));
        }
    };

    // Compute 10km maxBounds from user location
    const maxBounds = useMemo<
        [[number, number], [number, number]] | null
    >(() => {
        if (!userLocation) return null;
        const MAX_RADIUS_KM = 10;
        const latDelta = MAX_RADIUS_KM / 111;
        const lngDelta =
            MAX_RADIUS_KM /
            (111 * Math.cos((userLocation.lat * Math.PI) / 180));
        return [
            [userLocation.lng - lngDelta, userLocation.lat - latDelta], // SW
            [userLocation.lng + lngDelta, userLocation.lat + latDelta], // NE
        ];
    }, [userLocation]);

    // Show loading state while waiting for geolocation
    if (!locationReady) {
        return (
            <div className="relative h-full w-full flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Locate className="h-6 w-6 text-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">
                        Detecting your location...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            {/* Map */}
            <MapboxMap
                viewState={viewState}
                onViewStateChange={handleViewStateChange}
                clusters={processedClusters}
                supercluster={supercluster}
                userLocation={userLocation}
                maxBounds={maxBounds}
                onPinClick={(id) => setSelectedIssueId(id)}
                onClusterClick={(clusterId, lat, lng) => {
                    const zoom =
                        supercluster.getClusterExpansionZoom(clusterId);
                    setViewState((v) => ({
                        ...v,
                        latitude: lat,
                        longitude: lng,
                        zoom: Math.min(zoom, 18),
                    }));
                }}
            />

            {/* Layer toggle (top-right) */}
            <div className="absolute top-4 right-4 z-10">
                <LayerToggle
                    filters={filters}
                    onFiltersChange={setFilters}
                    showPersonal={showPersonalLayer}
                    onTogglePersonal={() => setShowPersonalLayer((v) => !v)}
                />
            </div>

            {/* Locate me button */}
            <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2">
                <Button
                    size="icon"
                    variant="secondary"
                    className="shadow-lg rounded-full h-10 w-10"
                    onClick={handleLocate}
                    title="Go to my location"
                >
                    <Locate className="h-4 w-4" />
                </Button>
            </div>

            {/* Report via mobile app */}
            {session && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                    <Button
                        size="lg"
                        className="shadow-xl rounded-full gap-2 px-6"
                        onClick={() => router.push("/report")}
                    >
                        <Plus className="h-5 w-5" />
                        Report via App
                    </Button>
                </div>
            )}

            {/* Sign in prompt for guests */}
            {!session && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                    <Button
                        variant="secondary"
                        size="lg"
                        className="shadow-xl rounded-full gap-2 px-6"
                        onClick={() => router.push("/auth/signin")}
                    >
                        <MapPin className="h-5 w-5" />
                        Sign in to report
                    </Button>
                </div>
            )}

            {/* Issue drawer */}
            {selectedIssueId && (
                <IssueDrawer
                    issueId={selectedIssueId}
                    onClose={() => setSelectedIssueId(null)}
                />
            )}
        </div>
    );
}
