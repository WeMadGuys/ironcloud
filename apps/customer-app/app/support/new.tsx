import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  SUPPORT_CATEGORIES,
  createTicket,
  type SupportCategoryValue,
} from '../../src/features/support/services/support.service';

export default function NewSupportRequestScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategoryValue | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Category required', 'Please select a category for your request.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe your issue.');
      return;
    }

    try {
      setSubmitting(true);
      const ticket = await createTicket({
        category,
        description: description.trim(),
      });
      router.replace(`/support/${ticket.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create request';
      Alert.alert('Could not submit', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>New request</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {SUPPORT_CATEGORIES.map((item) => {
              const selected = category === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCategory(item.value)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, styles.labelSpaced]}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us what happened..."
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={1000}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submit,
              (!category || !description.trim() || submitting) && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!category || !description.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.brand.onPrimary} />
            ) : (
              <Text style={styles.submitText}>Submit request</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
  labelSpaced: {
    marginTop: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
  },
  chipSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  chipText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: colors.brand.onPrimary,
  },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  charCount: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  submit: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.onPrimary,
  },
});
