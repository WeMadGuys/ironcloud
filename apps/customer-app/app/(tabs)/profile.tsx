import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { supabase } from '../../src/lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

interface UserProfile {
  fullName: string;
  phone: string;
  email: string | null;
  apartment: string;
  tower: string | null;
  flatNumber: string;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const userId = IS_MOCK_AUTH ? MOCK_USER_ID : null;
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { data: profileData } = await (supabase
        .from('profiles') as ReturnType<typeof supabase.from>)
        .select('full_name, phone, email')
        .eq('id', userId)
        .single();

      const { data: addressData } = await (supabase
        .from('addresses') as ReturnType<typeof supabase.from>)
        .select(`
          tower,
          flat_number,
          community:community_id (name)
        `)
        .eq('customer_id', userId)
        .eq('is_default', true)
        .single();

      const communityName = (addressData as { community: { name: string } | null })?.community?.name || 'Not set';

      setProfile({
        fullName: (profileData as { full_name: string })?.full_name || 'User',
        phone: (profileData as { phone: string })?.phone || '9999999999',
        email: (profileData as { email: string | null })?.email || null,
        apartment: communityName,
        tower: (addressData as { tower: string | null })?.tower || null,
        flatNumber: (addressData as { flat_number: string })?.flat_number || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
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
      label: 'My Addresses',
      subtitle: 'Manage your addresses',
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
      onPress: () => {},
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
        <Pressable style={styles.editButton}>
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
              <Text style={styles.avatarText}>
                {profile ? getInitials(profile.fullName) : 'U'}
              </Text>
            </View>
            <Pressable style={styles.cameraButton}>
              <MaterialCommunityIcons
                name="camera"
                size={16}
                color={colors.brand.onPrimary}
              />
            </Pressable>
          </View>
          <Text style={styles.userName}>{profile?.fullName || 'User'}</Text>
          <Text style={styles.userPhone}>+91 {profile?.phone || '9999999999'}</Text>
          {profile?.email && (
            <Text style={styles.userEmail}>{profile.email}</Text>
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
                {item.subtitle && (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                )}
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
});
