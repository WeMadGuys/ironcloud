import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  DELIVERY_FAILURE_REASONS,
  failRiderStop,
  PICKUP_FAILURE_REASONS,
} from '../services/fail-stop.service';

type Props = {
  orderId: string;
  jobType: 'pickup' | 'delivery';
  onFailed: () => void;
};

export function FailStopButton({ orderId, jobType, onFailed }: Props) {
  const reasons = jobType === 'pickup' ? PICKUP_FAILURE_REASONS : DELIVERY_FAILURE_REASONS;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await failRiderStop(orderId, jobType, selected);
      setOpen(false);
      Alert.alert(
        'Saved as failed',
        jobType === 'pickup'
          ? 'Pickup was not completed. The order stays open for another attempt.'
          : 'Delivery was not completed. The order stays open for another attempt.',
      );
      onFailed();
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error ? error.message : 'Try again',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Pressable
        style={styles.failBtn}
        onPress={() => {
          setSelected(null);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Could not complete this stop"
      >
        <Text style={styles.failText}>Could not complete</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setOpen(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>
              {jobType === 'pickup' ? 'Pickup failed' : 'Delivery failed'}
            </Text>
            <Text style={styles.hint}>Choose one reason. The order stays open.</Text>
            <ScrollView style={styles.list}>
              {reasons.map((reason) => {
                const active = selected === reason;
                return (
                  <Pressable
                    key={reason}
                    style={[styles.reason, active && styles.reasonActive]}
                    onPress={() => setSelected(reason)}
                    disabled={submitting}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={active ? colors.brand.primary : colors.icon.secondary}
                    />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={[styles.submit, (!selected || submitting) && styles.submitDisabled]}
              disabled={!selected || submitting}
              onPress={() => void submit()}
            >
              {submitting ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.submitText}>Submit failure</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.cancel}
              disabled={submitting}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  failBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.status.warning.foreground,
    backgroundColor: colors.surface.background,
  },
  failText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.status.warning.foreground,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 42, 74, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  hint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  list: { marginTop: spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  reasonActive: {},
  reasonText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
  submit: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
