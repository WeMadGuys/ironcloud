import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
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
  inputs,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { DevModeNotice } from '../../src/components/shared';
import {
  AUTH_PROVIDER,
  IS_MOCK_AUTH,
  MOCK_USER_ID,
  OTP_LENGTH,
} from '../../src/config/auth';
import { resendOtp, sendOtp, verifyOtp } from '../../src/features/auth/services/auth';
import { ensureMsg91Initialized } from '../../src/features/auth/services/msg91';
import { LegalConsentNotice } from '../../src/features/legal/components/LegalConsentNotice';
import { supabase } from '../../src/lib/supabase';


const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => '');

const FEATURES = [
  { icon: 'clock-outline' as const, label: '24 Hour\nService' },
  { icon: 'tshirt-crew-outline' as const, label: 'Premium\nFinish' },
  { icon: 'truck-outline' as const, label: 'Pickup &\nDelivery' },
  { icon: 'shield-check-outline' as const, label: 'Quality\nAssured' },
];

type ScreenState = 'phone' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const [screenState, setScreenState] = useState<ScreenState>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [otpError, setOtpError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const otpRefs = useRef<(TextInput | null)[]>(
    Array.from({ length: OTP_LENGTH }, () => null),
  );
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (AUTH_PROVIDER !== 'msg91') return;
    ensureMsg91Initialized().catch((err) => {
      console.warn('MSG91 init failed:', err);
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollFormIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const handlePhoneChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    setPhoneNumber(digitsOnly);
    if (error) setError('');
  };

  const transitionToOtp = () => {
    // Avoid LayoutAnimation + native-driver opacity on iOS — it can hide OTP inputs.
    setOtp([...EMPTY_OTP]);
    setOtpError('');
    setScreenState('otp');
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      requestAnimationFrame(() => {
        otpRefs.current[0]?.focus();
      });
    });
  };

  const handleContinue = async () => {
    if (isSending) return;
    if (phoneNumber.length === 0) {
      setError('Please enter your mobile number');
      return;
    }
    if (phoneNumber.length < 10) {
      setError('Mobile number must be 10 digits');
      return;
    }
    setError('');
    setIsSending(true);

    try {
      const result = await sendOtp(phoneNumber);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      transitionToOtp();
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleChangeNumber = () => {
    setOtp([...EMPTY_OTP]);
    setOtpError('');
    setScreenState('phone');
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (!cleaned) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    // SMS autofill / paste often dumps the full code into one box.
    if (cleaned.length > 1) {
      const code =
        cleaned.length > OTP_LENGTH
          ? cleaned.slice(-OTP_LENGTH)
          : cleaned.slice(0, OTP_LENGTH);
      const digits = code.split('');
      const newOtp = [...EMPTY_OTP];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtp(newOtp);
      if (otpError) setOtpError('');
      const focusIndex = Math.min(digits.length, OTP_LENGTH) - 1;
      otpRefs.current[focusIndex]?.blur();
      if (digits.length < OTP_LENGTH) {
        otpRefs.current[digits.length]?.focus();
      }
      return;
    }

    const digit = cleaned;
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (otpError) setOtpError('');

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (isResending || !phoneNumber) return;
    setIsResending(true);
    setOtpError('');
    try {
      const result = await resendOtp(phoneNumber);
      if (result.error) {
        setOtpError(result.error.message);
        return;
      }
      setOtp([...EMPTY_OTP]);
      otpRefs.current[0]?.focus();
    } catch {
      setOtpError('Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isVerifying) return;
    const otpValue = otp.join('');
    if (otpValue.length < OTP_LENGTH) {
      setOtpError(`Please enter the complete ${OTP_LENGTH}-digit OTP`);
      return;
    }
    setOtpError('');
    setIsVerifying(true);

    try {
      const result = await verifyOtp(phoneNumber, otpValue);
      if (result.error || !result.data?.success) {
        setOtpError(result.error?.message ?? 'Invalid OTP. Please try again.');
        return;
      }

      const userId = IS_MOCK_AUTH
        ? MOCK_USER_ID
        : result.data.userId ?? null;

      if (userId) {
        const { data: addresses } = await (supabase
          .from('addresses') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('customer_id', userId)
          .limit(1);

        if (addresses && addresses.length > 0) {
          router.replace('/(tabs)/home');
          return;
        }
      }

      router.replace('/(auth)/onboarding');
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setOtpError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const hasError = error.length > 0;
  const formattedPhone = `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.surface.background}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.scrollContentKeyboard,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
        >
          <View style={styles.cloudTop} />
          <View style={styles.cloudBottom} />

          <View style={[styles.header, keyboardVisible && styles.headerCompact]}>
            <Image
              source={require('../../assets/images/logo-mark.png')}
              style={[
                styles.brandLogo,
                keyboardVisible && styles.brandLogoCompact,
              ]}
              resizeMode="contain"
              accessibilityLabel="IronCloud"
            />
            <View style={styles.brandRow}>
              <Text style={styles.brandIron}>IRON</Text>
              <Text style={styles.brandCloud}> CLOUD</Text>
            </View>
            <View style={styles.brandDivider} />
          </View>

          <View style={[styles.heroCopy, keyboardVisible && styles.heroCopyCompact]}>
            <Text style={[styles.headline, keyboardVisible && styles.headlineCompact]}>
              {screenState === 'phone' ? 'Never Iron Again.' : 'Verify OTP'}
            </Text>
            {!keyboardVisible ? (
              <Text style={styles.subheadline}>
                {screenState === 'phone'
                  ? 'Freshly pressed. Perfectly delivered.'
                  : `Enter the ${OTP_LENGTH}-digit code sent to your phone`}
              </Text>
            ) : null}
          </View>

          {screenState === 'phone' && !keyboardVisible ? (
            <View style={styles.heroImageWrap}>
              <Image
                source={require('../../assets/images/hero-shirts.png')}
                style={styles.heroShirts}
                resizeMode="contain"
                accessibilityLabel="Freshly pressed shirts"
              />
            </View>
          ) : null}

          <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
            {screenState === 'phone' ? (
              <>
                <Text style={styles.inputLabel}>Enter your mobile number</Text>

                <View style={[styles.inputContainer, hasError && styles.inputContainerError]}>
                  <Pressable style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+91</Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={18}
                      color={colors.text.primary}
                    />
                  </Pressable>
                  <View style={styles.inputDivider} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile Number"
                    placeholderTextColor={inputs.placeholder.color}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    onFocus={scrollFormIntoView}
                    maxLength={10}
                  />
                </View>

                {hasError && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  style={[styles.continueButton, isSending && styles.continueButtonDisabled]}
                  onPress={handleContinue}
                  disabled={isSending}
                >
                  <Text style={styles.continueText}>
                    {isSending ? 'Sending…' : 'Continue'}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.brand.onPrimary}
                  />
                </Pressable>

                <LegalConsentNotice />

                {!keyboardVisible ? (
                  <View style={styles.trustRow}>
                    <View style={styles.trustIconWrap}>
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={18}
                        color={colors.brand.accent}
                      />
                    </View>
                    <View style={styles.trustCopy}>
                      <Text style={styles.trustTitle}>Secure. Private. Trusted.</Text>
                      <Text style={styles.trustSubtitle}>
                        We&apos;ll send you a one-time OTP to get started.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.phoneDisplay}>
                  <Text style={styles.phoneDisplayText}>{formattedPhone}</Text>
                  <Pressable onPress={handleChangeNumber}>
                    <Text style={styles.changeNumberText}>Change</Text>
                  </Pressable>
                </View>

                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        otpRefs.current[index] = ref;
                      }}
                      style={[
                        styles.otpBox,
                        digit && styles.otpBoxFilled,
                        otpError && styles.otpBoxError,
                      ]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, index)
                      }
                      onFocus={scrollFormIntoView}
                      keyboardType="number-pad"
                      // First box accepts full SMS autofill; others stay single-digit.
                      maxLength={index === 0 ? OTP_LENGTH : 1}
                      textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                      autoComplete={index === 0 ? 'sms-otp' : 'off'}
                      importantForAutofill={index === 0 ? 'yes' : 'no'}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

                {!keyboardVisible ? (
                  <View style={styles.devNoticeWrap}>
                    <DevModeNotice />
                  </View>
                ) : null}

                <Pressable
                  style={[
                    styles.continueButton,
                    isVerifying && styles.continueButtonDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={isVerifying}
                >
                  <Text style={styles.continueText}>
                    {isVerifying ? 'Verifying…' : 'Verify & Continue'}
                  </Text>
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={colors.brand.onPrimary}
                  />
                </Pressable>

                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
                  <Pressable onPress={handleResendOtp} disabled={isResending}>
                    <Text style={styles.resendLink}>
                      {isResending ? 'Sending…' : 'Resend OTP'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>

          {screenState === 'phone' && !keyboardVisible ? (
            <View style={styles.featuresRow}>
              {FEATURES.map((feature) => (
                <View key={feature.label} style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <MaterialCommunityIcons
                      name={feature.icon}
                      size={22}
                      color={colors.icon.primary}
                    />
                  </View>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  scrollContentKeyboard: {
    paddingBottom: spacing.lg,
    justifyContent: 'flex-start',
  },
  cloudTop: {
    position: 'absolute',
    top: spacing.sm,
    right: -spacing['3xl'],
    width: 160,
    height: 80,
    borderWidth: 1.5,
    borderColor: colors.brand.accentMuted,
    borderRadius: radius.full,
    opacity: 0.6,
    transform: [{ rotate: '-8deg' }],
  },
  cloudBottom: {
    position: 'absolute',
    bottom: 64,
    left: -spacing['4xl'],
    width: 180,
    height: 90,
    borderWidth: 1.5,
    borderColor: colors.brand.accentMuted,
    borderRadius: radius.full,
    opacity: 0.5,
    transform: [{ rotate: '12deg' }],
  },
  header: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.xs,
  },
  headerCompact: {
    marginTop: spacing.md,
    marginBottom: 0,
  },
  brandLogo: {
    width: 112,
    height: 112,
  },
  brandLogoCompact: {
    width: 64,
    height: 64,
  },
  brandRow: {
    flexDirection: 'row',
    marginTop: 0,
  },
  brandIron: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    color: colors.brand.primary,
    letterSpacing: 3,
  },
  brandCloud: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    color: colors.brand.accent,
    letterSpacing: 3,
  },
  brandDivider: {
    width: 44,
    height: 2,
    backgroundColor: colors.brand.accent,
    marginTop: spacing.sm,
    borderRadius: radius.full,
  },
  heroCopy: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heroCopyCompact: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headline: {
    fontFamily: fonts.poppins.bold,
    fontSize: 29,
    lineHeight: 35,
    color: colors.text.heading,
    textAlign: 'center',
  },
  headlineCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  subheadline: {
    fontFamily: fonts.inter.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heroImageWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroShirts: {
    width: 168,
    height: 116,
  },
  formSection: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.input,
    borderRadius: radius.input,
    backgroundColor: inputs.default.background,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  inputContainerError: {
    borderColor: colors.status.error.foreground,
    backgroundColor: colors.status.error.background,
  },
  errorText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.status.error.foreground,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
  },
  countryCodeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.heading,
  },
  inputDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.divider,
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15.5,
    color: colors.text.heading,
    paddingVertical: spacing.md,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.button,
    minHeight: 52,
    marginTop: spacing.lg,
    paddingHorizontal: spacing['5'],
    ...shadows.button.native,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
    flex: 1,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  trustIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brand.accentMuted,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  trustTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.primary,
  },
  trustSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xs,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm.native,
  },
  featureLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  phoneDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  phoneDisplayText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 18,
    color: colors.text.heading,
    letterSpacing: 1,
  },
  changeNumberText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.brand.link,
    marginLeft: spacing.md,
  },
  devNoticeWrap: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  otpBox: {
    width: 52,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border.input,
    borderRadius: radius.input,
    backgroundColor: colors.surface.elevated,
    textAlign: 'center',
    fontFamily: fonts.poppins.bold,
    fontSize: 22,
    color: colors.text.heading,
    padding: 0,
  },
  otpBoxFilled: {
    borderColor: colors.brand.accent,
    backgroundColor: colors.brand.accentMuted,
  },
  otpBoxError: {
    borderColor: colors.status.error.foreground,
    backgroundColor: colors.status.error.background,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
  resendLink: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.link,
  },
});
