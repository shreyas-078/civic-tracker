"use client";

import { useRef, useCallback, useEffect } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Map, Marker, Source, Layer } = require("react-map-gl/mapbox");
import type Supercluster from "supercluster";
import type { IssuePinData, IssueStatus } from "@/types";
type MapRef = any;
import { IssuePin } from "./IssuePin";
import { ClusterPin } from "./ClusterPin";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STATUS_COLORS: Record<IssueStatus, string> = {
    REPORTED: "#ef4444",
    VERIFIED: "#f59e0b",
    ASSIGNED: "#8b5cf6",
    RESOLVED: "#22c55e",
    CLOSED: "#6b7280",
};

interface Props {
    viewState: { latitude: number; longitude: number; zoom: number };
    onViewStateChange: (vs: {
        latitude: number;
        longitude: number;
        zoom: number;
    }) => void;
    clusters: GeoJSON.Feature[];
    supercluster: Supercluster;
    userLocation: { lat: number; lng: number } | null;
    maxBounds?: [[number, number], [number, number]] | null;
    onPinClick: (id: string) => void;
    onClusterClick: (clusterId: number, lat: number, lng: number) => void;
}

export default function MapboxMap({
    viewState,
    onViewStateChange,
    clusters,
    supercluster,
    userLocation,
    maxBounds,
    onPinClick,
    onClusterClick,
}: Props) {
    const mapRef = useRef<MapRef>(null);

    // Set maxBounds imperatively to avoid render loops
    useEffect(() => {
        const map = mapRef.current?.getMap?.();
        if (!map) return;
        map.setMaxBounds(maxBounds ?? undefined);
    }, [maxBounds]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleClick = useCallback((_e: unknown) => {}, []);

    // User location circle GeoJSON
    const userCircle = userLocation
        ? {
              type: "Feature" as const,
              geometry: {
                  type: "Point" as const,
                  coordinates: [userLocation.lng, userLocation.lat],
              },
              properties: {},
          }
        : null;

    if (!MAPBOX_TOKEN) {
        // Fallback: show a simple placeholder
        return (
            <div className="h-full w-full bg-white/[0.03] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                    Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the map.
                </p>
            </div>
        );
    }

    return (
        <Map
            ref={mapRef}
            {...viewState}
            onMove={(e: any) => onViewStateChange(e.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: "100%", height: "100%" }}
            onClick={handleClick}
            attributionControl={false}
        >
            {/* 2km geofence circle around user */}
            {userCircle && userLocation && (
                <>
                    <Source id="user-radius" type="geojson" data={userCircle}>
                        <Layer
                            id="user-radius-fill"
                            type="circle"
                            paint={{
                                "circle-radius": {
                                    base: 1.75,
                                    stops: [
                                        [10, 40],
                                        [14, 640],
                                    ],
                                },
                                "circle-color": "#2563eb",
                                "circle-opacity": 0.05,
                            }}
                        />
                    </Source>

                    {/* User dot */}
                    <Marker
                        longitude={userLocation.lng}
                        latitude={userLocation.lat}
                    >
                        <div className="relative">
                            <div className="h-4 w-4 rounded-full bg-brand border-2 border-white shadow-md" />
                            <div className="absolute inset-0 h-4 w-4 rounded-full bg-brand pin-ripple" />
                        </div>
                    </Marker>
                </>
            )}

            {/* Issue clusters and pins */}
            {clusters.map((feature) => {
                const [lng, lat] = (feature.geometry as any).coordinates as [
                    number,
                    number,
                ];
                const props = feature.properties as any;

                if (props.cluster) {
                    return (
                        <Marker
                            key={`cluster-${props.cluster_id}`}
                            longitude={lng}
                            latitude={lat}
                            onClick={() =>
                                onClusterClick(props.cluster_id, lat, lng)
                            }
                        >
                            <ClusterPin
                                count={props.point_count}
                                dimmed={props.dimmed}
                            />
                        </Marker>
                    );
                }

                const issue = props as IssuePinData & { dimmed?: boolean };
                return (
                    <Marker
                        key={issue.id}
                        longitude={lng}
                        latitude={lat}
                        onClick={() => onPinClick(issue.id)}
                    >
                        <IssuePin
                            status={issue.status}
                            isPersonal={issue.isPersonal}
                            dimmed={issue.dimmed}
                        />
                    </Marker>
                );
            })}
        </Map>
    );
}
