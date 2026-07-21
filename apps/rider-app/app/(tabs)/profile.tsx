import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { signOut } from '../../src/features/auth/services/auth';
import { getRiderProfile } from '../../src/features/jobs/services/jobs.service';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullName: string; phone: string } | null>(null);

  useEffect(() => {
    getRiderProfile().then(setProfile);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Rider Details</Text>
        <View style={styles.headerRightSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.fullName || 'R')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.fullName || 'Rider'}</Text>
        <Text style={styles.phone}>+91 {profile?.phone || '—'}</Text>

        <Pressable
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: handleLogout },
            ])
          }
        >
          <MaterialCommunityIcons name="logout" size={20} color={colors.status.error.foreground} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },
  content: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontFamily: fonts.poppins.bold, fontSize: 32, color: colors.brand.onPrimary },
  name: { fontFamily: fonts.poppins.semibold, fontSize: 22, color: colors.text.heading },
  phone: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.text.secondary, marginTop: spacing.xs },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.status.error.foreground,
  },
  logoutText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.status.error.foreground,
  },
});
