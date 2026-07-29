import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  inputs,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  searchCommunities,
  type Community,
} from '../../src/features/communities/services/communities.service';
import {
  completeOnboarding,
  validatePromoCode,
} from '../../src/features/profile/services/profile.service';
import {
  applyReferralCode,
  validateReferralCode,
} from '../../src/features/referrals/services/referral.service';

export default function OnboardingScreen() {
  const router = useRouter();

  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [tower, setTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [promoValidated, setPromoValidated] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [referralValidated, setReferralValidated] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);

  const handleSearchCommunities = useCallback(async (query: string) => {
    setCommunitySearch(query);
    if (query.length < 2) {
      setCommunities([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchCommunities(query);
      setCommunities(results);
    } catch (error) {
      console.error('Search error:', error);
      setCommunities([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setShowCommunityModal(false);
    setCommunitySearch('');
    setCommunities([]);
    clearError('community');
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    setIsApplyingPromo(true);
    setPromoMessage('');

    try {
      const result = await validatePromoCode(promoCode);
      if (result.valid) {
        setPromoValidated(true);
        setPromoMessage(`Promo applied! ${result.coupon?.discountType === 'percentage' ? `${result.coupon.discountValue}% off` : `₹${result.coupon?.discountValue} off`}`);
      } else {
        setPromoValidated(false);
        setPromoMessage(result.message || 'Invalid promo code');
      }
    } catch (error) {
      setPromoValidated(false);
      setPromoMessage('Failed to validate promo code');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) return;

    setIsApplyingReferral(true);
    setReferralMessage('');

    try {
      const result = await validateReferralCode(
        referralCode,
        selectedCommunity?.id ?? null,
      );
      if (result.valid) {
        setReferralValidated(true);
        const friendReward = result.program?.refereeReward;
        setReferralMessage(
          friendReward != null
            ? `Valid! You'll get ₹${friendReward} after your first qualifying recharge.`
            : 'Referral code applied.',
        );
      } else {
        setReferralValidated(false);
        setReferralMessage(result.message || 'Invalid referral code');
      }
    } catch {
      setReferralValidated(false);
      setReferralMessage('Failed to validate referral code');
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleContinue = async () => {
    const newErrors: Record<string, string> = {};

    if (!selectedCommunity) {
      newErrors.community = 'Please select your apartment';
    }
    if (!flatNumber.trim()) {
      newErrors.flatNumber = 'Please enter your flat number';
    }
    if (!fullName.trim()) {
      newErrors.fullName = 'Please enter your name';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await completeOnboarding({
        profile: {
          fullName: fullName.trim(),
          email: email.trim() || undefined,
        },
        address: {
          communityId: selectedCommunity!.id,
          tower: tower.trim() || undefined,
          flatNumber: flatNumber.trim(),
        },
        promoCode: promoValidated ? promoCode.trim() : undefined,
      });

      if (referralValidated && referralCode.trim()) {
        try {
          await applyReferralCode(
            referralCode.trim(),
            selectedCommunity!.id,
          );
        } catch (referralErr) {
          console.warn('Referral apply failed after onboarding:', referralErr);
        }
      }

      // Navigate to home tabs
      router.replace('/(tabs)/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.surface.background}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="map-marker"
              size={24}
              color={colors.brand.onPrimary}
            />
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.headline}>Where should{'\n'}we pick up?</Text>
          <Text style={styles.subheadline}>
            Add your address details to get started.
          </Text>
        </View>

        <View style={styles.formSection}>
          {/* Apartment / Society */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Apartment / Society</Text>
            <Pressable
              style={[
                styles.inputContainer,
                styles.selectContainer,
                errors.community && styles.inputContainerError,
              ]}
              onPress={() => setShowCommunityModal(true)}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={colors.icon.secondary}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.selectText,
                  !selectedCommunity && styles.placeholderText,
                ]}
                numberOfLines={1}
              >
                {selectedCommunity?.name || 'Search your apartment or society'}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color={colors.icon.secondary}
              />
            </Pressable>
            {errors.community ? (
              <Text style={styles.errorText}>{errors.community}</Text>
            ) : null}
            <Pressable style={styles.linkRow}>
              <Text style={styles.linkText}>Can't find your apartment?</Text>
            </Pressable>
          </View>

          {/* Tower & Flat Row */}
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Tower / Block</Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="office-building-outline"
                  size={20}
                  color={colors.icon.secondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Tower (optional)"
                  placeholderTextColor={inputs.placeholder.color}
                  value={tower}
                  onChangeText={setTower}
                />
              </View>
            </View>

            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Flat / House Number</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.flatNumber && styles.inputContainerError,
                ]}
              >
                <MaterialCommunityIcons
                  name="home-outline"
                  size={20}
                  color={colors.icon.secondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Flat no."
                  placeholderTextColor={inputs.placeholder.color}
                  value={flatNumber}
                  onChangeText={(text) => {
                    setFlatNumber(text);
                    clearError('flatNumber');
                  }}
                />
              </View>
              {errors.flatNumber ? (
                <Text style={styles.errorText}>{errors.flatNumber}</Text>
              ) : null}
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View
              style={[
                styles.inputContainer,
                errors.fullName && styles.inputContainerError,
              ]}
            >
              <MaterialCommunityIcons
                name="account-outline"
                size={22}
                color={colors.icon.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={inputs.placeholder.color}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  clearError('fullName');
                }}
                autoCapitalize="words"
              />
            </View>
            {errors.fullName ? (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            ) : null}
          </View>

          {/* Email Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>
              Email Address <Text style={styles.optionalText}>(optional)</Text>
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={colors.icon.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor={inputs.placeholder.color}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Promo Code */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>
              Promo Code <Text style={styles.optionalText}>(optional)</Text>
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="tag-outline"
                size={20}
                color={colors.icon.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.promoInput]}
                placeholder="Enter promo code"
                placeholderTextColor={inputs.placeholder.color}
                value={promoCode}
                onChangeText={(text) => {
                  setPromoCode(text);
                  setPromoValidated(false);
                  setPromoMessage('');
                }}
                autoCapitalize="characters"
                editable={!promoValidated}
              />
              {isApplyingPromo ? (
                <ActivityIndicator size="small" color={colors.brand.primary} />
              ) : promoValidated ? (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={colors.status.success.foreground}
                />
              ) : (
                <Pressable onPress={handleApplyPromo} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>APPLY</Text>
                </Pressable>
              )}
            </View>
            {promoMessage ? (
              <Text
                style={[
                  styles.promoMessage,
                  promoValidated ? styles.promoSuccess : styles.promoError,
                ]}
              >
                {promoMessage}
              </Text>
            ) : null}
          </View>

          {/* Referral Code */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>
              Referral Code <Text style={styles.optionalText}>(optional)</Text>
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="gift-outline"
                size={20}
                color={colors.icon.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.promoInput]}
                placeholder="Friend's referral code"
                placeholderTextColor={inputs.placeholder.color}
                value={referralCode}
                onChangeText={(text) => {
                  setReferralCode(text);
                  setReferralValidated(false);
                  setReferralMessage('');
                }}
                autoCapitalize="characters"
                editable={!referralValidated}
              />
              {isApplyingReferral ? (
                <ActivityIndicator size="small" color={colors.brand.primary} />
              ) : referralValidated ? (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={colors.status.success.foreground}
                />
              ) : (
                <Pressable onPress={handleApplyReferral} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>APPLY</Text>
                </Pressable>
              )}
            </View>
            {referralMessage ? (
              <Text
                style={[
                  styles.promoMessage,
                  referralValidated ? styles.promoSuccess : styles.promoError,
                ]}
              >
                {referralMessage}
              </Text>
            ) : null}
          </View>
        </View>

        {errors.submit ? (
          <View style={styles.submitErrorContainer}>
            <Text style={styles.submitErrorText}>{errors.submit}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, isSubmitting && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.brand.onPrimary} />
            ) : (
              <View style={styles.continueButtonContent}>
                <Text style={styles.continueText}>Continue</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color={colors.brand.onPrimary}
                />
              </View>
            )}
          </Pressable>

          <View style={styles.safetyRow}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={14}
              color={colors.text.muted}
              style={styles.safetyIcon}
            />
            <Text style={styles.safetyText}>Your information is safe with us.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Community Search Modal */}
      <Modal
        visible={showCommunityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCommunityModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Apartment / Society</Text>
            <Pressable
              onPress={() => setShowCommunityModal(false)}
              style={styles.modalCloseButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>

          <View style={styles.modalSearchContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={colors.icon.secondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search apartment or society..."
              placeholderTextColor={inputs.placeholder.color}
              value={communitySearch}
              onChangeText={handleSearchCommunities}
              autoFocus
            />
            {searchLoading && (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            )}
          </View>

          <FlatList
            data={communities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.communityItem}
                onPress={() => handleSelectCommunity(item)}
              >
                <MaterialCommunityIcons
                  name="office-building"
                  size={20}
                  color={colors.icon.secondary}
                />
                <View style={styles.communityInfo}>
                  <Text style={styles.communityName}>{item.name}</Text>
                  <Text style={styles.communityCity}>{item.city}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              communitySearch.length >= 2 && !searchLoading ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>No communities found</Text>
                  <Text style={styles.emptySubtext}>
                    Try a different search term
                  </Text>
    </View>
              ) : null
            }
            contentContainerStyle={styles.communityList}
          />
        </SafeAreaView>
      </Modal>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginTop: spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  headline: {
    fontFamily: fonts.poppins.bold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.text.heading,
  },
  subheadline: {
    fontFamily: fonts.inter.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  formSection: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  halfField: {
    flex: 1,
    maxWidth: '48%',
  },
  inputLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  optionalText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.muted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: radius.input,
    backgroundColor: colors.surface.elevated,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputContainerError: {
    borderColor: colors.status.error.foreground,
    backgroundColor: colors.status.error.background,
  },
  selectContainer: {
    paddingRight: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.heading,
    paddingVertical: spacing.md,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.heading,
  },
  placeholderText: {
    color: colors.text.placeholder,
  },
  promoInput: {
    flex: 1,
  },
  applyButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  applyButtonText: {
    fontFamily: fonts.inter.bold,
    fontSize: 14,
    color: colors.brand.link,
  },
  errorText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.status.error.foreground,
  },
  promoMessage: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
  },
  promoSuccess: {
    color: colors.status.success.foreground,
  },
  promoError: {
    color: colors.status.error.foreground,
  },
  linkRow: {
    marginTop: spacing.xs,
  },
  linkText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.brand.link,
  },
  submitErrorContainer: {
    backgroundColor: colors.status.error.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  submitErrorText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.status.error.foreground,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing['2xl'],
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.button,
    minHeight: 56,
    paddingHorizontal: spacing['5'],
    marginBottom: spacing.md,
    ...shadows.button.native,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
    flex: 1,
    textAlign: 'center',
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyIcon: {
    marginRight: spacing.xs,
  },
  safetyText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  modalTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border.input,
    borderRadius: radius.input,
    backgroundColor: colors.surface.elevated,
    minHeight: 52,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.heading,
    paddingVertical: spacing.md,
  },
  communityList: {
    paddingHorizontal: spacing.xl,
  },
  communityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  communityInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  communityName: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  communityCity: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: colors.text.primary,
  },
  emptySubtext: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
