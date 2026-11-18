import { useRef, useCallback, useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Colors } from "@/constants/theme";

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    color: string;
    emoji: string;
}

export interface MapCircle {
    lat: number;
    lng: number;
    radiusKm: number;
    fillColor: string;
    strokeColor: string;
}

interface LeafletMapProps {
    center: [number, number]; // [lat, lng]
    zoom?: number;
    markers?: MapMarker[];
    circles?: MapCircle[];
    showUserLocation?: boolean;
    userLat?: number;
    userLng?: number;
    /** If true, shows a draggable pin at pinLat/pinLng */
    draggablePin?: boolean;
    pinLat?: number;
    pinLng?: number;
    /**
     * When true, prevents the user from zooming/panning beyond the first circle
     * in the `circles` prop. Intended for the report screen where a 2km boundary
     * circle must stay visible at all times.
     */
    lockToCircle?: boolean;
    onMarkerPress?: (id: string) => void;
    onPinDrag?: (lat: number, lng: number) => void;
    style?: any;
}

function buildMapHTML(props: LeafletMapProps): string {
    const {
        center,
        zoom = 13,
        showUserLocation,
        userLat,
        userLng,
        draggablePin,
        pinLat,
        pinLng,
        lockToCircle,
        circles,
    } = props;

    // When lockToCircle, compute tight bounds from the first circle so the user
    // cannot zoom out or pan beyond the boundary circle.
    const lockCircle = lockToCircle && circles && circles.length > 0 ? circles[0] : null;
    let minZoomJS = "";
    let maxBoundsJS = "";
    if (lockCircle) {
        // 1 degree lat ≈ 111 km; pad by 30% so the circle ring itself is visible
        const latPad = (lockCircle.radiusKm * 1.3) / 111;
        const lngPad =
            (lockCircle.radiusKm * 1.3) /
            (111 * Math.cos((lockCircle.lat * Math.PI) / 180));
        const s = lockCircle.lat - latPad;
        const n = lockCircle.lat + latPad;
        const w = lockCircle.lng - lngPad;
        const e = lockCircle.lng + lngPad;
        // minZoom 12 keeps the 2km circle clearly visible; maxBounds locks panning
        minZoomJS = `map.setMinZoom(12);`;
        maxBoundsJS = `map.setMaxBounds([[${s}, ${w}], [${n}, ${e}]]);`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #0c0a07; }
  .emoji-marker {
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%; font-size: 14px; line-height: 1;
    width: 36px; height: 36px;
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .user-dot {
    width: 14px; height: 14px; background: #4285f4;
    border: 3px solid #fff; border-radius: 50%;
    box-shadow: 0 0 8px rgba(66,133,244,0.6);
  }
  .drag-pin {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(245,158,11,0.15); border: 2px solid #f59e0b;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .leaflet-tile-pane { filter: brightness(0.85) saturate(0.8); }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  var map = L.map('map', {
    center: [${center[0]}, ${center[1]}],
    zoom: ${zoom},
    zoomControl: false,
    attributionControl: false
  });

  // Expose map globally for dynamic updates
  window._map = map;
  window._markerLayer = L.layerGroup().addTo(map);
  window._circleLayer = L.layerGroup().addTo(map);

  // Enforce zoom/pan lock when a boundary circle is active
  ${minZoomJS}
  ${maxBoundsJS}

  // Dark tiles from CartoDB
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  // Dynamic marker update function
  window.updateMarkers = function(markers) {
    window._markerLayer.clearLayers();
    markers.forEach(function(m) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="emoji-marker" style="background:' + m.color + '">' + m.emoji + '</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      var marker = L.marker([m.lat, m.lng], { icon: icon });
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
      });
      window._markerLayer.addLayer(marker);
    });
  };

  // Dynamic circle update function
  window.updateCircles = function(circles) {
    window._circleLayer.clearLayers();
    circles.forEach(function(c) {
      var circle = L.circle([c.lat, c.lng], {
        radius: c.radiusKm * 1000,
        fillColor: c.fillColor,
        color: c.strokeColor,
        fillOpacity: 0.15,
        weight: 1
      });
      window._circleLayer.addLayer(circle);
    });
  };

  // User location dot
  ${
      showUserLocation && userLat && userLng
          ? `
  var userIcon = L.divIcon({
    className: '',
    html: '<div class="user-dot"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
  L.marker([${userLat}, ${userLng}], { icon: userIcon, interactive: false }).addTo(map);
  `
          : ""
  }

  // Draggable pin
  ${
      draggablePin
          ? `
  var pinIcon = L.divIcon({
    className: '',
    html: '<div class="drag-pin">📍</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
  var dragPin = L.marker([${pinLat ?? center[0]}, ${pinLng ?? center[1]}], {
    icon: pinIcon,
    draggable: true
  }).addTo(map);
  dragPin.on('dragend', function(e) {
    var pos = e.target.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pinDrag', lat: pos.lat, lng: pos.lng }));
  });
  `
          : ""
  }

  // Listen for commands from RN
  function handleMessage(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'flyTo') {
        map.flyTo([msg.lat, msg.lng], msg.zoom || map.getZoom(), { duration: 0.6 });
      }
      if (msg.type === 'updateMarkers') {
        window.updateMarkers(msg.markers);
      }
      if (msg.type === 'updateCircles') {
        window.updateCircles(msg.circles);
      }
    } catch(ex) {}
  }
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  // Signal that the map is ready
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
})();
</script>
</body>
</html>`;
}

export default function LeafletMap(props: LeafletMapProps) {
    const webRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);

    const onMessage = useCallback(
        (event: WebViewMessageEvent) => {
            try {
                const msg = JSON.parse(event.nativeEvent.data);
                if (msg.type === "mapReady") {
                    setMapReady(true);
                }
                if (msg.type === "markerPress" && props.onMarkerPress) {
                    props.onMarkerPress(msg.id);
                }
                if (msg.type === "pinDrag" && props.onPinDrag) {
                    props.onPinDrag(msg.lat, msg.lng);
                }
            } catch {}
        },
        [props.onMarkerPress, props.onPinDrag],
    );

    // Inject markers whenever they change or the map becomes ready
    useEffect(() => {
        if (!mapReady || !webRef.current) return;
        const markers = props.markers ?? [];
        const js = `window.updateMarkers(${JSON.stringify(markers)}); true;`;
        webRef.current.injectJavaScript(js);
    }, [mapReady, props.markers]);

    // Inject circles whenever they change or the map becomes ready
    useEffect(() => {
        if (!mapReady || !webRef.current) return;
        const circles = props.circles ?? [];
        const js = `window.updateCircles(${JSON.stringify(circles)}); true;`;
        webRef.current.injectJavaScript(js);
    }, [mapReady, props.circles]);

    const html = buildMapHTML(props);

    return (
        <View style={[styles.container, props.style]}>
            <WebView
                ref={webRef}
                source={{ html }}
                style={styles.webview}
                onMessage={onMessage}
                onLoadEnd={() => setLoading(false)}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={["*"]}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                setSupportMultipleWindows={false}
            />
            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                </View>
            )}
        </View>
    );
}

/** Send a flyTo command to the map */
export function flyTo(
    webRef: React.RefObject<WebView>,
    lat: number,
    lng: number,
    zoom?: number,
) {
    webRef.current?.postMessage(
        JSON.stringify({ type: "flyTo", lat, lng, zoom }),
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        overflow: "hidden",
    },
    webview: {
        flex: 1,
        backgroundColor: "transparent",
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.background,
    },
});
