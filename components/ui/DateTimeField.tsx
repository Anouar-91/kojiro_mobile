import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  icon?: keyof typeof Ionicons.glyphMap;
  minimumDate?: Date;
}

export function getDefaultMatchDateTime(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date;
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  icon,
  minimumDate,
}: DateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayValue =
    mode === 'date'
      ? format(value, 'EEEE d MMMM yyyy', { locale: fr })
      : format(value, 'HH:mm');

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed' || !selected) return;
    onChange(selected);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
      >
        {icon && <Ionicons name={icon} size={20} color={Colors.textMuted} style={styles.icon} />}
        <Text style={styles.value}>{displayValue}</Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
      </Pressable>

      {showPicker && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            minimumDate={mode === 'date' ? minimumDate : undefined}
            locale="fr-FR"
            themeVariant="dark"
            textColor={Colors.text}
          />
          {Platform.OS === 'android' && (
            <Pressable onPress={() => setShowPicker(false)} style={styles.androidClose}>
              <Text style={styles.androidCloseText}>OK</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  value: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    textTransform: 'capitalize',
  },
  pickerWrap: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  androidClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  androidCloseText: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
});
