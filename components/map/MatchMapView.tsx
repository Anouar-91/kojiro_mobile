import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Match } from '@/types';
import { PARIS_CENTER } from '@/types/geo';

interface MatchMapViewProps {
  matches: Match[];
  selectedId?: string | null;
  center?: { latitude: number; longitude: number };
  onSelectMatch?: (id: string) => void;
}

function buildMapHtml(
  matches: Match[],
  selectedId: string | null | undefined,
  center: { latitude: number; longitude: number }
): string {
  const markers = matches.map((m) => ({
    id: m.id,
    lat: m.location.latitude,
    lng: m.location.longitude,
    label: String(m.format),
    title: m.location.name,
    selected: m.id === selectedId,
  }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0A0A0B; }
    .kojiro-marker {
      background: #39FF14;
      color: #0A0A0B;
      font-weight: 800;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 14px;
      border: 2px solid #0A0A0B;
      white-space: nowrap;
      font-family: -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .kojiro-marker.selected {
      background: #FFFFFF;
      border-color: #39FF14;
      transform: scale(1.1);
    }
    .user-dot {
      width: 14px; height: 14px;
      background: #3B82F6;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.35);
    }
    .leaflet-control-zoom a {
      background: #1C1C1F !important;
      color: #39FF14 !important;
      border-color: #2A2A2E !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var markers = ${JSON.stringify(markers)};
    var center = [${center.latitude}, ${center.longitude}];
    var map = L.map('map', { zoomControl: true }).setView(center, 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 19
    }).addTo(map);

    L.marker(center, {
      icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [14,14], iconAnchor: [7,7] })
    }).addTo(map).bindPopup('Ta position');

    markers.forEach(function(m) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="kojiro-marker' + (m.selected ? ' selected' : '') + '">' + m.label + '</div>',
        iconSize: [36, 28],
        iconAnchor: [18, 14]
      });
      L.marker([m.lat, m.lng], { icon: icon })
        .addTo(map)
        .bindPopup('<b style="color:#0A0A0B">' + m.title + '</b>')
        .on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: m.id }));
          }
        });
    });

    if (markers.length > 0) {
      var points = markers.map(function(m) { return [m.lat, m.lng]; });
      points.push(center);
      var bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  </script>
</body>
</html>`;
}

export function MatchMapView({ matches, selectedId, center, onSelectMatch }: MatchMapViewProps) {
  const mapCenter = center ?? PARIS_CENTER;
  const mapHtml = useMemo(
    () => buildMapHtml(matches, selectedId, mapCenter),
    [matches, selectedId, mapCenter.latitude, mapCenter.longitude]
  );

  return (
    <View style={styles.wrapper}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        onMessage={(event) => {
          if (!onSelectMatch) return;
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'select' && data.id) onSelectMatch(data.id);
          } catch {
            // ignore
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFill,
  },
  map: {
    flex: 1,
    backgroundColor: '#0A0A0B',
  },
});
