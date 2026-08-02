import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { deleteAccount, signOut } from '../../src/features/auth/services/auth';
import {
  clearJobsCache,
  clearRiderProfileCache,
  getRiderProfile,
} from '../../src/features/jobs/services/jobs.service';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullName: string; phone: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    getRiderProfile().then(setProfile);
  }, []);

  const finishLocalSession = async () => {
    clearJobsCache();
    clearRiderProfileCache();
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finishLocalSession();
    } finally {
      setBusy(false);
    }
  };

  const performDeleteAccount = async () => {
    setBusy(true);
    try {
      const result = await deleteAccount();
      if (result.error) {
        Alert.alert('Delete failed', result.error.message);
        return;
      }
      clearJobsCache();
      clearRiderProfileCache();
      setShowEditModal(false);
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert(
        'Delete failed',
        error instanceof Error ? error.message : 'Could not delete account',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = () => {
    if (busy) return;

    Alert.alert(
      'Delete account',
      'Your rider account and personal data will be removed. Open jobs will be closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void performDeleteAccount();
          },
        },
      ],
    );
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
        <Pressable
          style={styles.editButton}
          onPress={() => setShowEditModal(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={22}
            color={colors.icon.primary}
          />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.fullName || 'R')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.fullName || 'Rider'}</Text>
        <Text style={styles.phone}>+91 {profile?.phone || '—'}</Text>

        <Pressable style={styles.menuButton} onPress={() => router.push('/legal/about')}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={colors.brand.primary}
          />
          <Text style={styles.menuText}>About</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.icon.secondary}
          />
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          disabled={busy}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => void handleLogout() },
            ])
          }
        >
          <MaterialCommunityIcons name="logout" size={20} color={colors.status.error.foreground} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !busy && setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Pressable
              onPress={() => !busy && setShowEditModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.icon.primary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.fieldValue}>
              <Text style={styles.fieldValueText}>{profile?.fullName || 'Rider'}</Text>
            </View>

            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.fieldValue}>
              <Text style={styles.fieldValueText}>+91 {profile?.phone || '—'}</Text>
            </View>

            <Pressable
              style={styles.deleteAccountLink}
              onPress={handleDeleteAccount}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              {busy ? (
                <ActivityIndicator color={colors.text.secondary} />
              ) : (
                <Text style={styles.deleteAccountLinkText}>Delete account</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  editButton: {
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
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
  },
  menuText: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.status.error.foreground,
    minHeight: 48,
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.status.error.foreground,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  modalTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.elevated,
  },
  fieldValueText: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.heading,
  },
  deleteAccountLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteAccountLinkText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
