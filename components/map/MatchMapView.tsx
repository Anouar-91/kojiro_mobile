import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Match } from '@/types';
import { PARIS_CENTER } from '@/types/geo';
import { getFormatLabel } from '@/utils/formatters';

interface MatchMapViewProps {
  matches: Match[];
  selectedId?: string | null;
  center?: { latitude: number; longitude: number };
  onSelectMatch?: (id: string) => void;
  onViewportChange?: (visibleIds: string[]) => void;
}

function buildMapHtml(
  matches: Match[],
  center: { latitude: number; longitude: number }
): string {
  const markers = matches.map((m) => ({
    id: m.id,
    lat: m.location.latitude,
    lng: m.location.longitude,
    label: getFormatLabel(m.format),
    title: m.location.name,
  }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0A0A0B; }
    .kojiro-marker, .kojiro-cluster {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #39FF14;
      color: #0A0A0B;
      font-weight: 800;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 14px;
      border: 2px solid #0A0A0B;
      white-space: nowrap;
      font-family: -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .kojiro-marker.selected {
      background: #FFFFFF;
      border-color: #39FF14;
      transform: scale(1.08);
    }
    .kojiro-marker-icon, .kojiro-cluster-icon {
      font-size: 12px;
      line-height: 1;
    }
    .kojiro-cluster {
      background: #2DD40F;
      padding: 6px 11px;
    }
    .kojiro-cluster-count {
      font-size: 13px;
      font-weight: 900;
      min-width: 10px;
      text-align: center;
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
    .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
      background: transparent !important;
    }
    .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
      background: transparent !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var markers = ${JSON.stringify(markers)};
    var center = [${center.latitude}, ${center.longitude}];
    var selectedId = null;
    var matchMarkers = {};
    var map = L.map('map', { zoomControl: true }).setView(center, 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 19
    }).addTo(map);

    L.marker(center, {
      icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [14,14], iconAnchor: [7,7] })
    }).addTo(map).bindPopup('Ta position');

    function markerHtml(label, selected) {
      return '<div class="kojiro-marker' + (selected ? ' selected' : '') + '">' +
        '<span class="kojiro-marker-icon">⚽</span>' +
        '<span class="kojiro-marker-label">' + label + '</span>' +
      '</div>';
    }

    function setSelected(id) {
      selectedId = id;
      Object.keys(matchMarkers).forEach(function(mid) {
        var layer = matchMarkers[mid];
        if (!layer || !layer._icon) return;
        var marker = markers.find(function(m) { return m.id === mid; });
        if (!marker) return;
        layer.setIcon(L.divIcon({
          className: '',
          html: markerHtml(marker.label, mid === id),
          iconSize: [58, 30],
          iconAnchor: [29, 15]
        }));
      });
    }

    window.__kojiroSetSelected = setSelected;

    function postViewport(visibleIds) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'viewport', visibleIds: visibleIds }));
      }
    }

    function updateViewport() {
      var bounds = map.getBounds();
      var visibleIds = markers
        .filter(function(m) { return bounds.contains([m.lat, m.lng]); })
        .map(function(m) { return m.id; });
      postViewport(visibleIds);
    }

    var clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        return L.divIcon({
          className: '',
          html: '<div class="kojiro-cluster">' +
            '<span class="kojiro-cluster-icon">⚽</span>' +
            '<span class="kojiro-cluster-count">' + count + '</span>' +
          '</div>',
          iconSize: [count > 9 ? 52 : 46, 32],
          iconAnchor: [count > 9 ? 26 : 23, 16]
        });
      }
    });

    markers.forEach(function(m) {
      var layer = L.marker([m.lat, m.lng], {
        icon: L.divIcon({
          className: '',
          html: markerHtml(m.label, false),
          iconSize: [58, 30],
          iconAnchor: [29, 15]
        })
      })
        .bindPopup('<b style="color:#0A0A0B">⚽ ' + m.label + '</b><br>' + m.title)
        .on('click', function() {
          setSelected(m.id);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: m.id }));
          }
        });
      matchMarkers[m.id] = layer;
      clusterGroup.addLayer(layer);
    });

    map.addLayer(clusterGroup);

    map.on('moveend', updateViewport);
    clusterGroup.on('animationend', updateViewport);

    map.whenReady(function() {
      if (markers.length > 0) {
        var points = markers.map(function(m) { return [m.lat, m.lng]; });
        points.push(center);
        var bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        map.once('moveend', updateViewport);
      } else {
        updateViewport();
      }
    });
  </script>
</body>
</html>`;
}

export function MatchMapView({
  matches,
  selectedId,
  center,
  onSelectMatch,
  onViewportChange,
}: MatchMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const mapCenter = center ?? PARIS_CENTER;
  const mapHtml = useMemo(
    () => buildMapHtml(matches, mapCenter),
    [matches, mapCenter.latitude, mapCenter.longitude]
  );

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `window.__kojiroSetSelected(${JSON.stringify(selectedId ?? null)}); true;`
    );
  }, [selectedId]);

  return (
    <View style={styles.wrapper}>
      <WebView
        ref={webViewRef}
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
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'select' && data.id) {
              onSelectMatch?.(data.id);
            } else if (data.type === 'viewport' && Array.isArray(data.visibleIds)) {
              onViewportChange?.(data.visibleIds);
            }
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
