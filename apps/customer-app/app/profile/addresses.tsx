import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  getActiveCommunities,
  getBlockFlats,
  getCommunityBlocks,
  getCommunityById,
  searchCommunities,
  type Community,
  type CommunityBlock,
  type CommunityFlat,
} from '../../src/features/communities/services/communities.service';
import {
  getCachedCustomerAddress,
  getCustomerAddress,
  saveCustomerAddress,
  type CustomerAddress,
} from '../../src/features/profile/services/address.service';

export default function AddressesScreen() {
  const router = useRouter();
  const [address, setAddress] = useState<CustomerAddress | null>(
    () => getCachedCustomerAddress(),
  );
  const [isLoading, setIsLoading] = useState(() => !getCachedCustomerAddress());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [showFlatPicker, setShowFlatPicker] = useState(false);

  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [tower, setTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [blocks, setBlocks] = useState<CommunityBlock[]>([]);
  const [flats, setFlats] = useState<CommunityFlat[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<CommunityBlock | null>(null);
  const [selectedFlat, setSelectedFlat] = useState<CommunityFlat | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const blocksEnabled = Boolean(selectedCommunity?.blocksEnabled);

  const loadAddress = useCallback(async () => {
    try {
      if (!getCachedCustomerAddress()) setIsLoading(true);
      setAddress(await getCustomerAddress());
    } catch (err) {
      console.error('Error loading address:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cached = getCachedCustomerAddress();
      if (cached) setAddress(cached);
      loadAddress();
    }, [loadAddress]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!selectedCommunity?.blocksEnabled) {
        setBlocks([]);
        setFlats([]);
        return;
      }

      setCatalogLoading(true);
      try {
        const nextBlocks = await getCommunityBlocks(selectedCommunity.id);
        if (cancelled) return;
        setBlocks(nextBlocks);

        setSelectedBlock((prev) => {
          if (prev && nextBlocks.some((b) => b.id === prev.id)) return prev;
          const match = nextBlocks.find(
            (b) => b.name.toLowerCase() === tower.trim().toLowerCase(),
          );
          return match ?? null;
        });
      } catch (err) {
        console.error('Error loading blocks:', err);
        if (!cancelled) setBlocks([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [selectedCommunity?.id, selectedCommunity?.blocksEnabled]);

  useEffect(() => {
    let cancelled = false;

    async function loadFlatsForBlock() {
      if (!blocksEnabled || !selectedBlock) {
        setFlats([]);
        setSelectedFlat(null);
        return;
      }

      setCatalogLoading(true);
      try {
        const nextFlats = await getBlockFlats(selectedBlock.id);
        if (cancelled) return;
        setFlats(nextFlats);
        setSelectedFlat((prev) => {
          if (prev && nextFlats.some((f) => f.id === prev.id)) return prev;
          const match = nextFlats.find(
            (f) =>
              f.flatNumber.toLowerCase() === flatNumber.trim().toLowerCase(),
          );
          return match ?? null;
        });
      } catch (err) {
        console.error('Error loading flats:', err);
        if (!cancelled) {
          setFlats([]);
          setSelectedFlat(null);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void loadFlatsForBlock();
    return () => {
      cancelled = true;
    };
  }, [blocksEnabled, selectedBlock?.id]);

  const openCommunityPicker = useCallback(async () => {
    setShowCommunityPicker(true);
    setCommunitySearch('');
    setSearchLoading(true);
    try {
      const list = await getActiveCommunities();
      setAllCommunities(list);
      setCommunities(list);
    } catch (err) {
      console.error('Error loading communities:', err);
      setAllCommunities([]);
      setCommunities([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchCommunities = useCallback(
    async (query: string) => {
      setCommunitySearch(query);
      const trimmed = query.trim();

      if (!trimmed) {
        setCommunities(allCommunities);
        return;
      }

      if (trimmed.length < 2) {
        const local = allCommunities.filter((c) =>
          c.name.toLowerCase().includes(trimmed.toLowerCase()),
        );
        setCommunities(local);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await searchCommunities(trimmed);
        setCommunities(results.length > 0 ? results : allCommunities.filter((c) =>
          c.name.toLowerCase().includes(trimmed.toLowerCase()),
        ));
      } catch {
        setCommunities(
          allCommunities.filter((c) =>
            c.name.toLowerCase().includes(trimmed.toLowerCase()),
          ),
        );
      } finally {
        setSearchLoading(false);
      }
    },
    [allCommunities],
  );

  const openEditModal = async () => {
    setSelectedBlock(null);
    setSelectedFlat(null);
    setBlocks([]);
    setFlats([]);

    if (address) {
      const community =
        (await getCommunityById(address.communityId)) ??
        ({
          id: address.communityId,
          name: address.communityName,
          city: address.city,
          status: 'active',
          blocksEnabled: false,
        } satisfies Community);
      setSelectedCommunity(community);
      setTower(address.tower ?? '');
      setFlatNumber(address.flatNumber);
    } else {
      setSelectedCommunity(null);
      setTower('');
      setFlatNumber('');
    }
    setShowCommunityPicker(false);
    setShowBlockPicker(false);
    setShowFlatPicker(false);
    setCommunitySearch('');
    setCommunities([]);
    setError('');
    setShowEditModal(true);
  };

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setShowCommunityPicker(false);
    setCommunitySearch('');
    setSelectedBlock(null);
    setSelectedFlat(null);
    setTower('');
    setFlatNumber('');
    setBlocks([]);
    setFlats([]);
  };

  const handleSelectBlock = (block: CommunityBlock) => {
    setSelectedBlock(block);
    setTower(block.name);
    setSelectedFlat(null);
    setFlatNumber('');
    setShowBlockPicker(false);
  };

  const handleSelectFlat = (flat: CommunityFlat) => {
    setSelectedFlat(flat);
    setFlatNumber(flat.flatNumber);
    setShowFlatPicker(false);
  };

  const handleSaveAddress = async () => {
    if (!selectedCommunity) {
      setError('Please select your apartment');
      return;
    }

    if (blocksEnabled) {
      if (!selectedBlock) {
        setError('Please select your block');
        return;
      }
      if (!selectedFlat) {
        setError('Please select your flat');
        return;
      }
    } else if (!flatNumber.trim()) {
      setError('Please enter your flat number');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const saved = await saveCustomerAddress({
        communityId: selectedCommunity.id,
        tower: blocksEnabled ? selectedBlock!.name : tower,
        flatNumber: blocksEnabled ? selectedFlat!.flatNumber : flatNumber,
      });
      setAddress(saved);
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!address;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Address</Text>
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
          {address ? (
            <View style={styles.addressCard}>
              <View style={styles.addressTop}>
                <View style={styles.addressIconWrap}>
                  <MaterialCommunityIcons
                    name="home-outline"
                    size={22}
                    color={colors.brand.accent}
                  />
                </View>
                <View style={styles.addressBody}>
                  <Text style={styles.addressName} numberOfLines={2}>
                    {address.communityName}
                  </Text>
                  <Text style={styles.addressDetail}>
                    {address.tower ? `Tower ${address.tower} • ` : ''}
                    Flat {address.flatNumber}
                  </Text>
                  {!!address.city && (
                    <Text style={styles.addressCity}>{address.city}</Text>
                  )}
                </View>
              </View>

              <Pressable style={styles.editButton} onPress={openEditModal}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={18}
                  color={colors.brand.onPrimary}
                />
                <Text style={styles.editButtonText}>Edit address</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={36}
                  color={colors.brand.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>No address yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your apartment address to book pickups.
              </Text>
              <Pressable style={styles.addButton} onPress={openEditModal}>
                <MaterialCommunityIcons
                  name="plus"
                  size={22}
                  color={colors.brand.onPrimary}
                />
                <Text style={styles.addButtonText}>Add address</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (showCommunityPicker) {
            setShowCommunityPicker(false);
            return;
          }
          if (showBlockPicker) {
            setShowBlockPicker(false);
            return;
          }
          if (showFlatPicker) {
            setShowFlatPicker(false);
            return;
          }
          setShowEditModal(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {showCommunityPicker ? (
            <>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setShowCommunityPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.icon.primary}
                  />
                </Pressable>
                <Text style={styles.modalTitle}>Select apartment</Text>
                <View style={styles.headerSpacer} />
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
                    <Text style={styles.emptySearch}>
                      {communitySearch.trim()
                        ? 'No apartments found'
                        : 'No active communities available'}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.communityItem,
                        selectedCommunity?.id === item.id && styles.communityItemSelected,
                      ]}
                      onPress={() => handleSelectCommunity(item)}
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
                      {selectedCommunity?.id === item.id && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={colors.brand.accent}
                        />
                      )}
                    </Pressable>
                  )}
                />
              )}
            </>
          ) : showBlockPicker ? (
            <>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setShowBlockPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.icon.primary}
                  />
                </Pressable>
                <Text style={styles.modalTitle}>Select block</Text>
                <View style={styles.headerSpacer} />
              </View>
              {catalogLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                </View>
              ) : (
                <FlatList
                  data={blocks}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.communityList}
                  ListEmptyComponent={
                    <Text style={styles.emptySearch}>No blocks available</Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.communityItem,
                        selectedBlock?.id === item.id && styles.communityItemSelected,
                      ]}
                      onPress={() => handleSelectBlock(item)}
                    >
                      <MaterialCommunityIcons
                        name="office-building-outline"
                        size={22}
                        color={colors.brand.accent}
                      />
                      <View style={styles.communityText}>
                        <Text style={styles.communityName}>{item.name}</Text>
                      </View>
                      {selectedBlock?.id === item.id && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={colors.brand.accent}
                        />
                      )}
                    </Pressable>
                  )}
                />
              )}
            </>
          ) : showFlatPicker ? (
            <>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setShowFlatPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.icon.primary}
                  />
                </Pressable>
                <Text style={styles.modalTitle}>Select flat</Text>
                <View style={styles.headerSpacer} />
              </View>
              {catalogLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                </View>
              ) : (
                <FlatList
                  data={flats}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.communityList}
                  ListEmptyComponent={
                    <Text style={styles.emptySearch}>No flats in this block</Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.communityItem,
                        selectedFlat?.id === item.id && styles.communityItemSelected,
                      ]}
                      onPress={() => handleSelectFlat(item)}
                    >
                      <MaterialCommunityIcons
                        name="home-outline"
                        size={22}
                        color={colors.brand.accent}
                      />
                      <View style={styles.communityText}>
                        <Text style={styles.communityName}>{item.flatNumber}</Text>
                      </View>
                      {selectedFlat?.id === item.id && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={colors.brand.accent}
                        />
                      )}
                    </Pressable>
                  )}
                />
              )}
            </>
          ) : (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditing ? 'Edit address' : 'Add address'}
                </Text>
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
                contentContainerStyle={styles.addForm}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.inputLabel}>Apartment / Society</Text>
                <Pressable style={styles.selectField} onPress={openCommunityPicker}>
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

                {blocksEnabled ? (
                  <View style={styles.rowFields}>
                    <View style={styles.halfField}>
                      <Text style={styles.inputLabel}>Block</Text>
                      <Pressable
                        style={[styles.selectField, styles.selectFieldInRow]}
                        onPress={() => setShowBlockPicker(true)}
                        disabled={!selectedCommunity || catalogLoading}
                      >
                        <Text
                          style={[
                            styles.selectText,
                            !selectedBlock && styles.placeholderText,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedBlock?.name || 'Select block'}
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-down"
                          size={20}
                          color={colors.icon.secondary}
                        />
                      </Pressable>
                    </View>
                    <View style={styles.halfField}>
                      <Text style={styles.inputLabel}>Flat</Text>
                      <Pressable
                        style={[
                          styles.selectField,
                          styles.selectFieldInRow,
                          !selectedBlock && styles.selectFieldDisabled,
                        ]}
                        onPress={() => selectedBlock && setShowFlatPicker(true)}
                        disabled={!selectedBlock || catalogLoading}
                      >
                        <Text
                          style={[
                            styles.selectText,
                            !selectedFlat && styles.placeholderText,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedFlat?.flatNumber ||
                            (selectedBlock ? 'Select flat' : 'Select block first')}
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-down"
                          size={20}
                          color={colors.icon.secondary}
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : (
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
                    <Text style={styles.saveButtonText}>
                      {isEditing ? 'Save changes' : 'Save address'}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </>
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
    marginBottom: spacing.lg,
  },
  addressCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    ...shadows.sm.native,
  },
  addressTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
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
  addressCity: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  editButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.onPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
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
    borderColor: colors.border.input,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.lg,
  },
  selectFieldInRow: {
    marginBottom: 0,
  },
  selectFieldDisabled: {
    opacity: 0.55,
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
    color: inputs.placeholder.color,
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
    borderColor: colors.border.input,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.input,
    borderRadius: radius.input,
    minHeight: 48,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
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
  communityItemSelected: {
    backgroundColor: colors.brand.accentMuted,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
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
