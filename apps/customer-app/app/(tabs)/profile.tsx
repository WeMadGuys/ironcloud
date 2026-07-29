import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { AUTH_PROVIDER } from '../../src/config/auth';
import {
  clearProfileCache,
  fetchUserProfile,
  getCachedProfile,
  updateProfile,
  type UserProfileData,
} from '../../src/features/profile/services/profile.service';
import { supabase } from '../../src/lib/supabase';

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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!IS_MOCK_AUTH) {
                await supabase.auth.signOut();
              }
            } catch (error) {
              console.warn('Logout signOut failed:', error);
            }
            clearProfileCache();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const menuItems: MenuItem[] = [
    {
      id: 'orders',
      icon: 'clipboard-list-outline',
      label: 'My Orders',
      subtitle: 'View your order history',
      onPress: () => router.push('/(tabs)/orders'),
      showArrow: true,
    },
    {
      id: 'addresses',
      icon: 'map-marker-outline',
      label: 'My Address',
      subtitle: 'View or edit your address',
      onPress: () => router.push('/profile/addresses'),
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
      subtitle: 'App version 1.0.0',
      onPress: () => {},
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={[styles.editButton, (isLoading || !profile) && styles.editButtonDisabled]}
          onPress={openEditModal}
          disabled={isLoading || !profile}
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            color={colors.brand.accent}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.avatarText}>
                  {profile ? getInitials(profile.fullName) : 'U'}
                </Text>
              )}
            </View>
            <Pressable style={styles.cameraButton}>
              <MaterialCommunityIcons
                name="camera"
                size={16}
                color={colors.brand.onPrimary}
              />
            </Pressable>
          </View>
          {isLoading ? (
            <View style={styles.profileLoading}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : (
            <>
              <Text style={styles.userName}>{profile?.fullName || 'User'}</Text>
              <Text style={styles.userPhone}>{formatDisplayPhone(profile?.phone)}</Text>
              {profile?.email ? (
                <Text style={styles.userEmail}>{profile.email}</Text>
              ) : null}
            </>
          )}
        </View>

        {/* Address Card */}
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <MaterialCommunityIcons
              name="map-marker"
              size={20}
              color={colors.brand.accent}
            />
            <Text style={styles.addressLabel}>Default Address</Text>
          </View>
          <Text style={styles.addressName}>{profile?.apartment || 'Not set'}</Text>
          <Text style={styles.addressDetail}>
            {profile?.tower ? `Tower ${profile.tower} • ` : ''}Flat {profile?.flatNumber || 'N/A'}
          </Text>
        </View>

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
              <View style={[styles.menuIconWrap, item.color && { backgroundColor: `${item.color}15` }]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={22}
                  color={item.color || colors.icon.secondary}
                />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, item.color && { color: item.color }]}>
                  {item.label}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                ) : null}
              </View>
              {item.showArrow && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={colors.icon.muted}
                />
              )}
            </Pressable>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Iron Cloud v1.0.0</Text>
          <Text style={styles.appInfoSubtext}>Made with ❤️ in India</Text>
        </View>
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md.native,
  },
  avatarText: {
    fontFamily: fonts.poppins.bold,
    fontSize: 36,
    color: colors.brand.onPrimary,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface.background,
  },
  profileLoading: {
    paddingVertical: spacing.md,
  },
  userName: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 22,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  userPhone: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.secondary,
  },
  userEmail: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  addressCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addressLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.brand.accent,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: 4,
  },
  addressDetail: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
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
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  appInfoText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.muted,
  },
  appInfoSubtext: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
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
});
