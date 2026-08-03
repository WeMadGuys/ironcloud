import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import type { ActiveBooking } from '../services/booking.service';

type Props = {
  booking: ActiveBooking;
  onSubmit: (rating: number, feedback: string) => Promise<void>;
  onDismiss: () => Promise<void>;
};

export function DeliveredFeedbackBanner({
  booking,
  onSubmit,
  onDismiss,
}: Props) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = submitting || dismissing;

  const handleSubmit = async () => {
    if (rating < 1 || busy) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(rating, feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (busy) return;
    setError(null);
    setDismissing(true);
    try {
      await onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close');
      setDismissing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.accentRail} />
        <View style={styles.cardBody}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={18}
                color={colors.status.success.foreground}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Delivered</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                How was your Iron Cloud experience?
              </Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={handleDismiss}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Close feedback for order ${booking.orderNumber}`}
              hitSlop={8}
            >
              {dismissing ? (
                <ActivityIndicator size="small" color={colors.text.muted} />
              ) : (
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.text.muted}
                />
              )}
            </Pressable>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= rating;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                  hitSlop={4}
                >
                  <MaterialCommunityIcons
                    name={filled ? 'star' : 'star-outline'}
                    size={30}
                    color={
                      filled
                        ? colors.status.rating
                        : colors.brand.accentSoft
                    }
                  />
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.feedbackInput}
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Tell us more (optional)"
            placeholderTextColor={colors.text.placeholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!busy}
            maxLength={500}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[
              styles.submitButton,
              (rating < 1 || busy) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={rating < 1 || busy}
            accessibilityRole="button"
            accessibilityLabel="Submit feedback"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.brand.onPrimary} />
            ) : (
              <Text style={styles.submitText}>Submit feedback</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.brand.accentMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
    overflow: 'hidden',
    ...shadows.sm.native,
  },
  accentRail: {
    width: 3,
    backgroundColor: colors.status.success.foreground,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  subtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  feedbackInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.status.error.foreground,
  },
  submitButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.onPrimary,
  },
});
