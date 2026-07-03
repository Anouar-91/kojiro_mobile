import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Match } from '@/types';

const PARIS = { lat: 48.8566, lng: 2.3522 };

interface MatchMapViewProps {
  matches: Match[];
  selectedId: string | null;
  onSelectMatch: (id: string) => void;
}

function buildMapHtml(matches: Match[]): string {
  const markers = matches.map((m) => ({
    id: m.id,
    lat: m.location.latitude,
    lng: m.location.longitude,
    label: String(m.format),
    title: m.location.name,
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
    var map = L.map('map', { zoomControl: true }).setView([${PARIS.lat}, ${PARIS.lng}], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 19
    }).addTo(map);

    markers.forEach(function(m) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="kojiro-marker">' + m.label + '</div>',
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

    if (markers.length > 1) {
      var bounds = L.latLngBounds(markers.map(function(m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  </script>
</body>
</html>`;
}

export function MatchMapView({ matches, onSelectMatch }: MatchMapViewProps) {
  return (
    <View style={styles.wrapper}>
      <WebView
        source={{ html: buildMapHtml(matches) }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'select' && data.id) onSelectMatch(data.id);
          } catch {
            // ignore parse errors
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
