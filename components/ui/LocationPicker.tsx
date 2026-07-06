import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input } from '@/components/ui/Input';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { reverseGeocode, searchCities, searchPlaces, getPlaceDisplayText } from '@/services/geocoding';
import { GeoPlace } from '@/types/geo';

interface LocationPickerProps {
  label: string;
  placeholder?: string;
  value: GeoPlace | null;
  onChange: (place: GeoPlace | null) => void;
  mode?: 'venue' | 'city';
  showCurrentLocation?: boolean;
}

export function LocationPicker({
  label,
  placeholder = 'Rechercher un lieu...',
  value,
  onChange,
  mode = 'venue',
  showCurrentLocation = mode === 'venue',
}: LocationPickerProps) {
  const displayText = value ? getPlaceDisplayText(value, mode) : '';
  const [query, setQuery] = useState(displayText || value?.name || '');
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (value) setQuery(getPlaceDisplayText(value, mode));
  }, [value, mode]);

  useEffect(() => {
    const q = query.trim();
    const minLen = 2;
    const selectedText = value ? getPlaceDisplayText(value, mode) : '';
    if (!q || q.length < minLen || (value && q === selectedText)) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = mode === 'city' ? await searchCities(q) : await searchPlaces(q);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, mode, value]);

  const handleSelect = useCallback(
    (place: GeoPlace) => {
      onChange(place);
      setQuery(getPlaceDisplayText(place, mode));
      setSuggestions([]);
    },
    [onChange, mode]
  );

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorise la localisation pour utiliser ta position.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const place = await reverseGeocode(position.coords.latitude, position.coords.longitude, mode);
      if (!place) {
        Alert.alert('Erreur', 'Impossible de déterminer ton adresse.');
        return;
      }

      handleSelect(place);
    } catch {
      Alert.alert('Erreur', 'Localisation indisponible.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        placeholder={placeholder}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (value && text !== getPlaceDisplayText(value, mode)) onChange(null);
        }}
        icon="location-outline"
      />

      {showCurrentLocation && (
        <Pressable style={styles.gpsBtn} onPress={handleUseCurrentLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          )}
          <Text style={styles.gpsText}>Utiliser ma position actuelle</Text>
        </Pressable>
      )}

      {value && (
        <View style={styles.selected}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <View style={styles.selectedContent}>
            {mode === 'venue' && value.name !== value.address && (
              <Text style={styles.selectedName}>{value.name}</Text>
            )}
            <Text style={styles.selectedText} numberOfLines={3}>
              {value.address}
            </Text>
          </View>
        </View>
      )}

      {searching && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((place, i) => (
            <Pressable
              key={`${place.latitude}-${place.longitude}-${i}`}
              style={styles.suggestion}
              onPress={() => handleSelect(place)}
            >
              <Ionicons name="location" size={16} color={Colors.primary} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName}>
                  {mode === 'venue' && place.name !== place.address ? place.name : place.address}
                </Text>
                {mode === 'venue' && place.name !== place.address && (
                  <Text style={styles.suggestionAddr} numberOfLines={2}>
                    {place.address}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  gpsText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  selected: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  selectedContent: { flex: 1 },
  selectedName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14, marginBottom: 2 },
  selectedText: { ...Typography.caption, color: Colors.textSecondary },
  loader: { marginBottom: Spacing.sm },
  suggestions: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: { flex: 1 },
  suggestionName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
  suggestionAddr: { ...Typography.small, color: Colors.textMuted, marginTop: 2 },
});
