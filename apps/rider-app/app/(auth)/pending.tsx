import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing, typographyScale } from '@ironcloud/ui';

import {
  getRiderActivation,
  signOut,
} from '../../src/features/auth/services/auth';

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

export default function PendingActivationScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');

  const handleRefresh = useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const { isActive, error } = await getRiderActivation();
      if (isActive) {
        router.replace('/(tabs)/home');
        return;
      }
      if (error) {
        setMessage(
          error.includes('permission') || error.includes('policy') || error.includes('RLS')
            ? 'Could not read activation status (database permissions). Ask ops to apply migration 006.'
            : `Still pending. (${error})`,
        );
        return;
      }
      setMessage('Still pending. Contact ops if you were recently approved.');
    } catch {
      setMessage('Could not check status. Try again.');
    } finally {
      setChecking(false);
    }
  }, [router]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/(auth)/login');
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="account-clock-outline"
            size={48}
            color={colors.brand.accent}
          />
        </View>
        <Text style={styles.title}>Account pending activation</Text>
        <Text style={styles.body}>
          Your rider account is registered but not activated yet. An admin will
          verify and activate you from the portal. You cannot take jobs until then.
        </Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable
          style={[styles.primaryButton, checking && styles.disabled]}
          onPress={handleRefresh}
          disabled={checking || signingOut}
        >
          {checking ? (
            <ActivityIndicator color={colors.brand.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Check status</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, signingOut && styles.disabled]}
          onPress={handleSignOut}
          disabled={checking || signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.brand.primary} />
          ) : (
            <Text style={styles.secondaryText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm.native,
  },
  title: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    color: colors.text.heading,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  message: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.button.native,
  },
  primaryText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  secondaryText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.primary,
  },
  disabled: {
    opacity: 0.7,
  },
});
