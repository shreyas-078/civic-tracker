"use client";

import { useRef, useMemo, useEffect, useCallback, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Map, Marker, Source, Layer } = require("react-map-gl/mapbox");
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
    lat: number;
    lng: number;
    onLocationChange: (loc: { lat: number; lng: number }) => void;
    userLocation?: { lat: number; lng: number } | null;
    maxRadiusKm?: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MiniMap({
    lat,
    lng,
    onLocationChange,
    userLocation,
    maxRadiusKm,
}: Props) {
    const mapRef = useRef<any>(null);
    const prevCoords = useRef({ lat, lng });
    const hasFlownToUser = useRef(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Fly to new coordinates when lat/lng props change significantly — only after map is ready
    useEffect(() => {
        if (!mapLoaded) return;
        const latDiff = Math.abs(prevCoords.current.lat - lat);
        const lngDiff = Math.abs(prevCoords.current.lng - lng);
        if (latDiff > 0.001 || lngDiff > 0.001) {
            mapRef.current?.flyTo({
                center: [lng, lat],
                duration: 800,
            });
        }
        prevCoords.current = { lat, lng };
    }, [lat, lng, mapLoaded]);

    // Memoize maxBounds to keep a stable reference
    const maxBounds = useMemo(() => {
        if (!userLocation || !maxRadiusKm) return undefined;
        const latDelta = maxRadiusKm / 111;
        const lngDelta =
            maxRadiusKm / (111 * Math.cos((userLocation.lat * Math.PI) / 180));
        return [
            [userLocation.lng - lngDelta, userLocation.lat - latDelta],
            [userLocation.lng + lngDelta, userLocation.lat + latDelta],
        ] as [[number, number], [number, number]];
    }, [userLocation?.lat, userLocation?.lng, maxRadiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

    // Set maxBounds imperatively to avoid render loops (same approach as main MapboxMap)
    useEffect(() => {
        if (!mapLoaded) return;
        const map = mapRef.current?.getMap?.();
        if (!map) return;
        map.setMaxBounds(maxBounds ?? null);
    }, [maxBounds, mapLoaded]);

    // When userLocation is first detected, fly to it (only once, only after map is ready)
    useEffect(() => {
        if (
            !userLocation ||
            !mapRef.current ||
            hasFlownToUser.current ||
            !mapLoaded
        )
            return;
        hasFlownToUser.current = true;
        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 14,
            duration: 800,
        });
    }, [userLocation, mapLoaded]);

    const handleMapClick = useCallback(
        (e: any) => {
            onLocationChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        },
        [onLocationChange],
    );

    const handleDragEnd = useCallback(
        (e: any) => {
            onLocationChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        },
        [onLocationChange],
    );

    // Memoized GeoJSON for the radius circle — avoids calling setData on every render
    const radiusCircle = useMemo(
        () =>
            userLocation && maxRadiusKm
                ? {
                      type: "Feature" as const,
                      geometry: {
                          type: "Point" as const,
                          coordinates: [userLocation.lng, userLocation.lat],
                      },
                      properties: {},
                  }
                : null,
        [userLocation?.lat, userLocation?.lng, maxRadiusKm], // eslint-disable-line react-hooks/exhaustive-deps
    );

    if (!MAPBOX_TOKEN) {
        return (
            <div className="h-full bg-muted flex items-center justify-center">
                <p className="text-xs text-muted-foreground text-center px-4">
                    Map unavailable — add NEXT_PUBLIC_MAPBOX_TOKEN
                </p>
            </div>
        );
    }

    return (
        <Map
            ref={mapRef}
            initialViewState={{
                latitude: lat,
                longitude: lng,
                zoom: 14,
            }}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: "100%", height: "100%" }}
            onClick={handleMapClick}
            onLoad={() => setMapLoaded(true)}
        >
            {/* Radius circle */}
            {radiusCircle && (
                <Source id="report-radius" type="geojson" data={radiusCircle}>
                    <Layer
                        id="report-radius-fill"
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
                            "circle-opacity": 0.08,
                        }}
                    />
                </Source>
            )}

            <Marker
                longitude={lng}
                latitude={lat}
                draggable
                onDragEnd={handleDragEnd}
            >
                <div className="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
                    <span className="text-white text-xs">📍</span>
                </div>
            </Marker>
        </Map>
    );
}
