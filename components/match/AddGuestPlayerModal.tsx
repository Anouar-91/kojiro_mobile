import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface AddGuestPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  presentCount: number;
  maxPlayers: number;
}

export function AddGuestPlayerModal({
  visible,
  onClose,
  onSubmit,
  presentCount,
  maxPlayers,
}: AddGuestPlayerModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    setName('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Nom trop court (2 caractères minimum).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setName('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'ajouter ce joueur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter sans appli</Text>
            <Pressable onPress={handleClose} hitSlop={12} disabled={loading}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Pour quelqu'un qui n'a pas Kojiro. Il comptera dans l'effectif et la composition,
            sans notif ni stats persistantes.
          </Text>
          <Text style={styles.quota}>
            Places : {presentCount}/{maxPlayers}
          </Text>

          <Input
            label="Nom du joueur"
            placeholder="Ex: Karim (cousin)"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            icon="person-outline"
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Button title="Annuler" onPress={handleClose} variant="ghost" disabled={loading} />
            <Button
              title="Ajouter"
              onPress={handleSubmit}
              loading={loading}
              icon="person-add-outline"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  quota: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
