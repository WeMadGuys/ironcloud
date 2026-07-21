import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  addAddress,
  listAddresses,
  setDefaultAddress,
  type CustomerAddress,
} from '../../src/features/profile/services/address.service';

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [tower, setTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listAddresses();
      setAddresses(data);
    } catch (err) {
      console.error('Error loading addresses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses]),
  );

  const handleSearchCommunities = useCallback(async (query: string) => {
    setCommunitySearch(query);
    if (query.length < 2) {
      setCommunities([]);
      return;
    }
    setSearchLoading(true);
    try {
      setCommunities(await searchCommunities(query));
    } catch {
      setCommunities([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const openAddModal = () => {
    setSelectedCommunity(null);
    setCommunitySearch('');
    setCommunities([]);
    setTower('');
    setFlatNumber('');
    setMakeDefault(addresses.length === 0);
    setError('');
    setShowAddModal(true);
  };

  const handleSaveAddress = async () => {
    if (!selectedCommunity) {
      setError('Please select your apartment');
      return;
    }
    if (!flatNumber.trim()) {
      setError('Please enter your flat number');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await addAddress({
        communityId: selectedCommunity.id,
        tower,
        flatNumber,
        makeDefault,
      });
      setShowAddModal(false);
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId);
      await loadAddresses();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update default address',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {addresses.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={36}
                  color={colors.brand.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>No addresses yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your apartment address to book pickups easily.
              </Text>
            </View>
          ) : (
            addresses.map((address) => (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressTop}>
                  <View style={styles.addressIconWrap}>
                    <MaterialCommunityIcons
                      name="home-outline"
                      size={22}
                      color={colors.brand.accent}
                    />
                  </View>
                  <View style={styles.addressBody}>
                    <View style={styles.addressTitleRow}>
                      <Text style={styles.addressName} numberOfLines={1}>
                        {address.communityName}
                      </Text>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressDetail}>
                      {address.tower ? `Tower ${address.tower} • ` : ''}
                      Flat {address.flatNumber}
                    </Text>
                    {!!address.city && (
                      <Text style={styles.addressCity}>{address.city}</Text>
                    )}
                  </View>
                </View>
                {!address.isDefault && (
                  <Pressable
                    style={styles.setDefaultButton}
                    onPress={() => handleSetDefault(address.id)}
                  >
                    <Text style={styles.setDefaultText}>Set as default</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}

          <Pressable style={styles.addButton} onPress={openAddModal}>
            <MaterialCommunityIcons name="plus" size={22} color={colors.brand.onPrimary} />
            <Text style={styles.addButtonText}>Add New Address</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Add Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Address</Text>
            <Pressable
              onPress={() => setShowAddModal(false)}
              style={styles.modalCloseButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.icon.primary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.addForm}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.inputLabel}>Apartment / Society</Text>
            <Pressable
              style={styles.selectField}
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

            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Tower / Block</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={inputs.placeholder.color}
                    value={tower}
                    onChangeText={setTower}
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Flat Number</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1204"
                    placeholderTextColor={inputs.placeholder.color}
                    value={flatNumber}
                    onChangeText={setFlatNumber}
                  />
                </View>
              </View>
            </View>

            {addresses.length > 0 && (
              <Pressable
                style={styles.checkboxRow}
                onPress={() => setMakeDefault((prev) => !prev)}
              >
                <MaterialCommunityIcons
                  name={makeDefault ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={makeDefault ? colors.brand.accent : colors.icon.muted}
                />
                <Text style={styles.checkboxLabel}>Set as default address</Text>
              </Pressable>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSaveAddress}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save Address</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
              <MaterialCommunityIcons name="close" size={24} color={colors.icon.primary} />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={colors.icon.secondary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search apartment name..."
              placeholderTextColor={inputs.placeholder.color}
              value={communitySearch}
              onChangeText={handleSearchCommunities}
              autoFocus
            />
          </View>

          {searchLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : (
            <FlatList
              data={communities}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.communityList}
              ListEmptyComponent={
                communitySearch.length >= 2 ? (
                  <Text style={styles.emptySearch}>No apartments found</Text>
                ) : (
                  <Text style={styles.emptySearch}>Type at least 2 characters to search</Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.communityItem}
                  onPress={() => {
                    setSelectedCommunity(item);
                    setShowCommunityModal(false);
                    setCommunitySearch('');
                    setCommunities([]);
                  }}
                >
                  <MaterialCommunityIcons
                    name="office-building"
                    size={22}
                    color={colors.brand.accent}
                  />
                  <View style={styles.communityText}>
                    <Text style={styles.communityName}>{item.name}</Text>
                    <Text style={styles.communityCity}>{item.city}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  addressCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm.native,
  },
  addressTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  addressBody: {
    flex: 1,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  addressName: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  defaultBadge: {
    backgroundColor: colors.brand.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  defaultBadgeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.brand.accent,
  },
  addressDetail: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
  addressCity: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  setDefaultButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  setDefaultText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.accent,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  modalContainer: {
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
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  inputLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
  placeholderText: {
    color: colors.text.muted,
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  halfField: {
    flex: 1,
  },
  inputContainer: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkboxLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.status.error.foreground,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  communityList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  communityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
    gap: spacing.md,
  },
  communityText: {
    flex: 1,
  },
  communityName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  communityCity: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  emptySearch: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
