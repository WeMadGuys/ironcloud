import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { AUTH_PROVIDER } from '../../src/config/auth';
import { deleteAccount, signOut } from '../../src/features/auth/services/auth';
import { clearOrdersCache } from '../../src/features/orders/services/orders.service';
import {
  clearAddressCache,
} from '../../src/features/profile/services/address.service';
import {
  clearProfileCache,
  fetchUserProfile,
  getCachedProfile,
  removeProfileAvatar,
  updateProfile,
  uploadProfileAvatar,
  type UserProfileData,
} from '../../src/features/profile/services/profile.service';
import { clearWalletCache } from '../../src/features/wallet/services/wallet.service';
import {
  clearReferralCache,
  prefetchMyReferral,
} from '../../src/features/referrals/services/referral.service';

const IS_MOCK_AUTH = AUTH_PROVIDER === 'mock';

function formatDisplayPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Phone not set';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone.trim();
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface MenuItem {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  color?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(
    () => getCachedProfile(),
  );
  const [isLoading, setIsLoading] = useState(() => !getCachedProfile());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const loadProfile = useCallback(async () => {
    const showLoading = !getCachedProfile();
    if (showLoading) setIsLoading(true);

    try {
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      // Warm referral cache while user is on Profile.
      prefetchMyReferral();
    }, [loadProfile]),
  );

  const openEditModal = () => {
    if (!profile) return;
    setEditFullName(profile.fullName === 'User' ? '' : profile.fullName);
    setEditEmail(profile.email ?? '');
    setEditErrors({});
    setShowEditModal(true);
  };

  const clearEditError = (field: string) => {
    setEditErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    if (isUploadingAvatar) return;

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        source === 'camera'
          ? 'Camera access is needed to take a profile photo.'
          : 'Photo library access is needed to choose a profile photo.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadProfileAvatar(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev));
    } catch (error) {
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not update profile photo',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    if (isLoading || isUploadingAvatar || !profile) return;

    const options: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [
      { text: 'Take photo', onPress: () => pickAndUploadAvatar('camera') },
      { text: 'Choose from library', onPress: () => pickAndUploadAvatar('library') },
    ];

    if (profile.avatarUrl) {
      options.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Remove photo', 'Remove your profile photo?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                setIsUploadingAvatar(true);
                try {
                  await removeProfileAvatar();
                  setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
                } catch (error) {
                  Alert.alert(
                    'Remove failed',
                    error instanceof Error
                      ? error.message
                      : 'Could not remove profile photo',
                  );
                } finally {
                  setIsUploadingAvatar(false);
                }
              },
            },
          ]);
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', 'Choose an option', options);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editFullName.trim();
    const trimmedEmail = editEmail.trim();
    const newErrors: Record<string, string> = {};

    if (!trimmedName) {
      newErrors.fullName = 'Please enter your name';
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setEditErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    try {
      await updateProfile({
        fullName: trimmedName,
        email: trimmedEmail || undefined,
      });
      const data = await fetchUserProfile();
      setProfile(data);
      setShowEditModal(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update profile';
      setEditErrors({ submit: message });
    } finally {
      setIsSaving(false);
    }
  };

  const performLogout = async () => {
    try {
      if (!IS_MOCK_AUTH) {
        const result = await signOut();
        if (result.error) {
          console.warn('Logout signOut failed:', result.error.message);
        }
      }
    } catch (error) {
      console.warn('Logout signOut failed:', error);
    } finally {
      clearProfileCache();
      clearReferralCache();
      clearOrdersCache();
      clearWalletCache();
      clearAddressCache();
      router.replace('/(auth)/login');
    }
  };

  const performDeleteAccount = async () => {
    try {
      const result = await deleteAccount();
      if (result.error) {
        Alert.alert('Delete failed', result.error.message);
        return;
      }
    } catch (error) {
      Alert.alert(
        'Delete failed',
        error instanceof Error ? error.message : 'Could not delete account',
      );
      return;
    }

    clearProfileCache();
    clearReferralCache();
    clearOrdersCache();
    clearWalletCache();
    clearAddressCache();
    router.replace('/(auth)/login');
  };

  const handleLogout = () => {
    // RN Web's Alert.alert often does not show multi-button dialogs.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm('Are you sure you want to logout?');
      if (confirmed) void performLogout();
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            void performLogout();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    const message =
      'Your account and personal data will be removed. Open bookings will be cancelled.';

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm(`Delete account?\n\n${message}`);
      if (confirmed) void performDeleteAccount();
      return;
    }

    Alert.alert('Delete account', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          void performDeleteAccount();
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      id: 'orders',
      icon: 'clipboard-list-outline',
      label: 'My Orders',
      subtitle: 'View your order history',
      onPress: () => router.push('/profile/orders'),
      showArrow: true,
    },
    {
      id: 'notifications',
      icon: 'bell-outline',
      label: 'Notifications',
      subtitle: 'Manage notification preferences',
      onPress: () => router.push('/profile/notifications'),
      showArrow: true,
    },
    {
      id: 'referrals',
      icon: 'gift-outline',
      label: 'Refer & Earn',
      subtitle: 'Invite friends and earn wallet cashback',
      onPress: () => router.push('/profile/referrals'),
      showArrow: true,
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: 'Help & Support',
      subtitle: 'Get help with your orders',
      onPress: () => router.push('/support'),
      showArrow: true,
    },
    {
      id: 'about',
      icon: 'information-outline',
      label: 'About',
      subtitle: 'Privacy Policy, Terms & app info',
      onPress: () => router.push('/profile/about'),
      showArrow: true,
    },
    {
      id: 'logout',
      icon: 'logout',
      label: 'Logout',
      onPress: handleLogout,
      showArrow: false,
      color: colors.status.error.foreground,
    },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const addressLine = [
    profile?.apartment && profile.apartment !== 'Not set'
      ? profile.apartment
      : null,
    profile?.tower ? `T-${profile.tower}` : null,
    profile?.flatNumber ? `#${profile.flatNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      {/* Top actions — no page title */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {isLoading || isUploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.brand.onPrimary} />
              ) : profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImage}
                  accessibilityLabel="Profile photo"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {profile ? getInitials(profile.fullName) : 'U'}
                </Text>
              )}
            </View>
            <Pressable
              style={[
                styles.cameraButton,
                (isLoading || isUploadingAvatar || !profile) && styles.cameraButtonDisabled,
              ]}
              onPress={handleChangeAvatar}
              disabled={isLoading || isUploadingAvatar || !profile}
            >
              <MaterialCommunityIcons
                name="camera"
                size={14}
                color={colors.brand.onPrimary}
              />
            </Pressable>
          </View>

          <View style={styles.identityText}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              <>
                <Text style={styles.userName} numberOfLines={1}>
                  {profile?.fullName || 'User'}
                </Text>
                <Text style={styles.userPhone} numberOfLines={1}>
                  {formatDisplayPhone(profile?.phone)}
                </Text>
                {profile?.email ? (
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {profile.email}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <Pressable
            style={[styles.editButton, (isLoading || !profile) && styles.editButtonDisabled]}
            onPress={openEditModal}
            disabled={isLoading || !profile}
            accessibilityLabel="Edit profile"
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={colors.brand.accent}
            />
          </Pressable>
        </View>

        {!isLoading ? (
          <Pressable
            style={styles.addressChip}
            onPress={() => router.push('/profile/addresses')}
          >
            <View style={styles.addressIconWrap}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={colors.brand.accent}
              />
            </View>
            <Text style={styles.addressText} numberOfLines={1}>
              {addressLine || 'Add your address'}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.icon.muted}
            />
          </Pressable>
        ) : null}

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.menuItemLast,
              ]}
              onPress={item.onPress}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  item.color && { backgroundColor: `${item.color}15` },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={item.color || colors.icon.secondary}
                />
              </View>
              <View style={styles.menuContent}>
                <Text
                  style={[styles.menuLabel, item.color && { color: item.color }]}
                >
                  {item.label}
                </Text>
                {item.id === 'about' && item.subtitle ? (
                  <Text style={styles.menuSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              {item.showArrow && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.icon.muted}
                />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={styles.appInfoText}>Iron Cloud v1.0.0</Text>
      </ScrollView>

      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.icon.primary}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.editForm}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View
                  style={[
                    styles.inputContainer,
                    editErrors.fullName && styles.inputContainerError,
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
                    value={editFullName}
                    onChangeText={(text) => {
                      setEditFullName(text);
                      clearEditError('fullName');
                    }}
                    autoCapitalize="words"
                  />
                </View>
                {editErrors.fullName ? (
                  <Text style={styles.errorText}>{editErrors.fullName}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>
                  Email Address{' '}
                  <Text style={styles.optionalText}>(optional)</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    editErrors.email && styles.inputContainerError,
                  ]}
                >
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
                    value={editEmail}
                    onChangeText={(text) => {
                      setEditEmail(text);
                      clearEditError('email');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {editErrors.email ? (
                  <Text style={styles.errorText}>{editErrors.email}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={[styles.inputContainer, styles.inputContainerDisabled]}>
                  <MaterialCommunityIcons
                    name="phone-outline"
                    size={20}
                    color={colors.icon.secondary}
                    style={styles.inputIcon}
                  />
                  <Text style={styles.readOnlyInput}>
                    {formatDisplayPhone(profile?.phone)}
                  </Text>
                </View>
                <Text style={styles.fieldHint}>
                  Phone number is linked to your login and cannot be changed here.
                </Text>
              </View>

              {editErrors.submit ? (
                <Text style={styles.errorText}>{editErrors.submit}</Text>
              ) : null}

              <Pressable
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.brand.onPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>Save changes</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.deleteAccountLink}
                onPress={handleDeleteAccount}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <Text style={styles.deleteAccountLinkText}>Delete account</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerSpacer: {
    width: 40,
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
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editButtonDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    color: colors.brand.onPrimary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface.elevated,
  },
  cameraButtonDisabled: {
    opacity: 0.6,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  userName: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  userPhone: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
  },
  userEmail: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  addressIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
  },
  menuContainer: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.primary,
  },
  menuSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  appInfoText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  modalKeyboardView: {
    flex: 1,
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
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editForm: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  optionalText: {
    fontFamily: fonts.inter.regular,
    color: colors.text.muted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.input,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputContainerError: {
    borderColor: colors.status.error.foreground,
  },
  inputContainerDisabled: {
    backgroundColor: colors.surface.background,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  readOnlyInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.muted,
    paddingVertical: spacing.sm,
  },
  fieldHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.status.error.foreground,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  deleteAccountLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteAccountLinkText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
