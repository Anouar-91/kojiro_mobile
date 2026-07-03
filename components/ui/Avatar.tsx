import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, Colors, Typography } from '@/constants/theme';

interface AvatarProps {
  uri: string;
  size?: number;
  name?: string;
  showBorder?: boolean;
  style?: ViewStyle;
}

export function Avatar({ uri, size = 40, name, showBorder = false, style }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        showBorder && styles.border,
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

interface AvatarGroupProps {
  uris: string[];
  size?: number;
  max?: number;
}

export function AvatarGroup({ uris, size = 28, max = 4 }: AvatarGroupProps) {
  const visible = uris.slice(0, max);
  const remaining = uris.length - max;

  return (
    <View style={styles.group}>
      {visible.map((uri, i) => (
        <View key={i} style={[styles.groupItem, { marginLeft: i > 0 ? -8 : 0, zIndex: max - i }]}>
          <Avatar uri={uri} size={size} showBorder />
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.moreBadge, { width: size, height: size, borderRadius: size / 2, marginLeft: -8 }]}>
          <Text style={[styles.moreText, { fontSize: size * 0.35 }]}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  border: {
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  fallback: {
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupItem: {},
  moreBadge: {
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  moreText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
