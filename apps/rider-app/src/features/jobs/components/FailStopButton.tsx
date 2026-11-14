import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  /** Quiet text action for a list card. The sheet is unchanged. */
  compact?: boolean;
};

/** Not a saved reason. Pickup only: rider types the message instead. */
const OTHER_REASON = '__other__';
const CUSTOM_REASON_MAX = 200;

export function FailStopButton({ orderId, jobType, onFailed, compact = false }: Props) {
  const reasons = jobType === 'pickup' ? PICKUP_FAILURE_REASONS : DELIVERY_FAILURE_REASONS;
  const allowCustom = jobType === 'pickup';
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedCustom = customMessage.trim();
  const usingCustom = allowCustom && selected === OTHER_REASON;
  const reasonToSave = usingCustom ? trimmedCustom : selected;
  const canSubmit = Boolean(
    reasonToSave && reasonToSave.length > 0 && reasonToSave.length <= CUSTOM_REASON_MAX,
  );

  const submit = async () => {
    if (!canSubmit || !reasonToSave) return;
    setSubmitting(true);
    try {
      await failRiderStop(orderId, jobType, reasonToSave);
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

  const openSheet = () => {
    setSelected(null);
    setCustomMessage('');
    setOpen(true);
  };

  return (
    <>
      {compact ? (
        <Pressable
          style={styles.failLink}
          onPress={openSheet}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Could not complete this stop"
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={14}
            color={colors.status.warning.foreground}
          />
          <Text style={styles.failLinkText}>Couldn't complete</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.failBtn}
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel="Could not complete this stop"
        >
          <Text style={styles.failText}>Could not complete</Text>
        </Pressable>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>
              {jobType === 'pickup' ? 'Pickup failed' : 'Delivery failed'}
            </Text>
            <Text style={styles.hint}>
              {allowCustom
                ? 'Choose one reason, or write your own. The order stays open.'
                : 'Choose one reason. The order stays open.'}
            </Text>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
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
              {allowCustom ? (
                <Pressable
                  style={[styles.reason, usingCustom && styles.reasonActive]}
                  onPress={() => setSelected(OTHER_REASON)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ selected: usingCustom }}
                >
                  <MaterialCommunityIcons
                    name={usingCustom ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={usingCustom ? colors.brand.primary : colors.icon.secondary}
                  />
                  <Text style={styles.reasonText}>Other</Text>
                </Pressable>
              ) : null}
              {usingCustom ? (
                <TextInput
                  style={styles.customInput}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  placeholder="What happened?"
                  placeholderTextColor={colors.text.muted}
                  multiline
                  maxLength={CUSTOM_REASON_MAX}
                  editable={!submitting}
                  textAlignVertical="top"
                  accessibilityLabel="Custom failure message"
                />
              ) : null}
            </ScrollView>
            <Pressable
              style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
              disabled={!canSubmit || submitting}
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
        </KeyboardAvoidingView>
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
  failLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  failLinkText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
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
  list: { marginTop: spacing.sm, flexGrow: 0, flexShrink: 1 },
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
  customInput: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.surface.background,
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
