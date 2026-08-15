import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  RefreshControl,
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
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  calcClientWalletBonus,
  canApplyWalletCoupon,
  getCachedApplicableWalletOffers,
  getCachedWallet,
  getWallet,
  getWalletTransactions,
  listApplicableWalletCoupons,
  topUpWallet,
  type ApplicableWalletCoupon,
  type PendingReferralOffer,
  type WalletTransaction,
} from '../../src/features/wallet/services/wallet.service';
import { TransactionRow } from '../../src/features/wallet/components/TransactionRow';
import { isExpoGo } from '../../src/lib/expo-go';

const QUICK_AMOUNTS = [100, 200, 500, 1000];
const RECENT_TRANSACTION_LIMIT = 5;

export default function WalletScreen() {
  const router = useRouter();
  const cachedWallet = getCachedWallet();
  const cachedOffers = getCachedApplicableWalletOffers();
  const [balance, setBalance] = useState(cachedWallet?.balance ?? 0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(() => !cachedWallet);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [applicableCoupons, setApplicableCoupons] = useState<ApplicableWalletCoupon[]>(
    () => cachedOffers?.coupons ?? [],
  );
  const [referralOffer, setReferralOffer] = useState<PendingReferralOffer | null>(
    () => cachedOffers?.referralOffer ?? null,
  );
  const [couponsLoading, setCouponsLoading] = useState(() => !cachedOffers);
  const [selectedCouponCode, setSelectedCouponCode] = useState<string | null>(null);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const applyOffers = useCallback(
    (offers: { coupons: ApplicableWalletCoupon[]; referralOffer: PendingReferralOffer | null }) => {
      setApplicableCoupons(offers.coupons);
      setReferralOffer(offers.referralOffer);
      setCouponsLoading(false);
    },
    [],
  );

  const loadWalletData = useCallback(async (force = true) => {
    try {
      // Keep existing balance visible while refreshing after cache hits.
      if (!getCachedWallet()) setIsLoading(true);

      const couponsPrefetch = listApplicableWalletCoupons()
        .then((offers) => {
          applyOffers(offers);
        })
        .catch(() => {
          if (!getCachedApplicableWalletOffers()) {
            setApplicableCoupons([]);
            setReferralOffer(null);
          }
          setCouponsLoading(false);
        });

      const walletInfo = await getWallet({ force });
      const txns = await getWalletTransactions(RECENT_TRANSACTION_LIMIT, {
        walletId: walletInfo?.id,
      });

      if (walletInfo) {
        setBalance(walletInfo.balance);
      }
      setTransactions(txns);
      await couponsPrefetch;
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyOffers]);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await loadWalletData(true);
    } finally {
      setPullRefreshing(false);
    }
  }, [loadWalletData]);

  useFocusEffect(
    useCallback(() => {
      void loadWalletData(true);
    }, [loadWalletData]),
  );

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void loadWalletData(true);
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [loadWalletData]);

  useEffect(() => {
    if (!showAddMoney) return;

    let cancelled = false;
    const cached = getCachedApplicableWalletOffers();
    if (cached) {
      applyOffers(cached);
    } else {
      setCouponsLoading(true);
    }

    // Refresh quietly (or fetch if cache miss). Deduped by service TTL cache.
    listApplicableWalletCoupons()
      .then((offers) => {
        if (cancelled) return;
        applyOffers(offers);
      })
      .catch(() => {
        if (cancelled) return;
        if (!getCachedApplicableWalletOffers()) {
          setApplicableCoupons([]);
          setReferralOffer(null);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setCouponsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyOffers, showAddMoney]);

  useEffect(() => {
    if (!selectedCouponCode) return;
    const coupon = applicableCoupons.find((c) => c.code === selectedCouponCode);
    if (!coupon) {
      setSelectedCouponCode(null);
      return;
    }
    const amount = parseInt(addAmount, 10) || 0;
    if (!canApplyWalletCoupon(coupon, amount)) {
      setSelectedCouponCode(null);
    }
  }, [addAmount, applicableCoupons, selectedCouponCode]);

  const selectedCoupon =
    applicableCoupons.find((c) => c.code === selectedCouponCode) ?? null;
  const parsedAmount = parseInt(addAmount, 10);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const bonusAmount =
    selectedCoupon && canApplyWalletCoupon(selectedCoupon, validAmount)
      ? calcClientWalletBonus(selectedCoupon, validAmount)
      : 0;
  const referralUnlocked =
    referralOffer != null && validAmount >= Number(referralOffer.minTopup);
  const referralBonus = referralUnlocked ? Number(referralOffer.reward) : 0;
  const extraTotal = Math.round((bonusAmount + referralBonus) * 100) / 100;
  const creditTotal = Math.round((validAmount + extraTotal) * 100) / 100;

  const closeAddMoney = () => {
    setShowAddMoney(false);
    setAddAmount('');
    setApplicableCoupons([]);
    setReferralOffer(null);
    setSelectedCouponCode(null);
  };

  const handleAddMoney = async () => {
    if (!validAmount || isToppingUp) return;

    try {
      setIsToppingUp(true);
      const result = await topUpWallet({
        amount: validAmount,
        couponCode: selectedCouponCode,
      });
      setBalance(result.balance);
      closeAddMoney();
      await loadWalletData();
      Alert.alert(
        'Money added',
        result.bonus > 0
          ? `₹${result.creditTotal} credited (₹${validAmount} + ₹${result.bonus} bonus).`
          : `₹${result.creditTotal} credited to your wallet.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top-up failed';
      Alert.alert('Could not add money', message);
    } finally {
      setIsToppingUp(false);
    }
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
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.walletIconWrap}>
              <MaterialCommunityIcons
                name="wallet"
                size={28}
                color={colors.brand.onPrimary}
              />
            </View>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>
                <Text style={styles.balanceCurrency}>₹</Text>
                {balance}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.addMoneyButton}
            onPress={() => setShowAddMoney(true)}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={colors.brand.onPrimary}
            />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </Pressable>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/wallet/transactions')}>
              <Text style={styles.seeAllText}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.transactionsList}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.brand.primary} />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={48}
                  color={colors.text.muted}
                />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>Add money to get started</Text>
              </View>
            ) : (
              transactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  isLast={index === transactions.length - 1}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Money Modal */}
      <Modal
        visible={showAddMoney}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAddMoney}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Money</Text>
            <Pressable onPress={closeAddMoney} style={styles.modalCloseButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount Input */}
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                value={addAmount}
                onChangeText={setAddAmount}
                maxLength={5}
                underlineColorAndroid="transparent"
              />
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((amount) => (
                <Pressable
                  key={amount}
                  style={[
                    styles.quickAmountButton,
                    addAmount === amount.toString() && styles.quickAmountButtonActive,
                  ]}
                  onPress={() => setAddAmount(amount.toString())}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      addAmount === amount.toString() && styles.quickAmountTextActive,
                    ]}
                  >
                    ₹{amount}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.couponsSection}>
              <Text style={styles.couponsTitle}>Available coupons</Text>
              {couponsLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.brand.primary}
                  style={styles.couponsLoader}
                />
              ) : applicableCoupons.length === 0 && !referralOffer ? (
                <Text style={styles.couponsEmpty}>No coupons available right now</Text>
              ) : (
                <>
                  {referralOffer ? (
                    <View
                      style={[
                        styles.couponRow,
                        referralUnlocked && styles.couponRowSelected,
                        !referralUnlocked && styles.couponRowDisabled,
                      ]}
                    >
                      <View style={styles.couponText}>
                        <Text style={styles.couponCode}>REFERRAL</Text>
                        <Text style={styles.couponLabel}>{referralOffer.label}</Text>
                        {!referralUnlocked ? (
                          <Text style={styles.couponHint}>
                            Enter ₹{referralOffer.minTopup} or more to unlock
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.couponApplyBtn,
                          referralUnlocked && styles.couponApplyBtnSelected,
                          !referralUnlocked && styles.couponApplyBtnDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.couponApplyText,
                            referralUnlocked && styles.couponApplyTextSelected,
                            !referralUnlocked && styles.couponApplyTextDisabled,
                          ]}
                        >
                          {referralUnlocked ? 'Auto-applied' : 'Locked'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {applicableCoupons.map((coupon) => {
                    const selected = selectedCouponCode === coupon.code;
                    const canApply = canApplyWalletCoupon(coupon, validAmount);
                    const needMore =
                      coupon.minAmount != null && validAmount < Number(coupon.minAmount);
                    return (
                      <View
                        key={coupon.id}
                        style={[
                          styles.couponRow,
                          selected && styles.couponRowSelected,
                          !canApply && styles.couponRowDisabled,
                        ]}
                      >
                        <View style={styles.couponText}>
                          <Text style={styles.couponCode}>{coupon.code}</Text>
                          <Text style={styles.couponLabel}>{coupon.label}</Text>
                          {needMore ? (
                            <Text style={styles.couponHint}>
                              Enter ₹{coupon.minAmount} or more to apply
                            </Text>
                          ) : null}
                        </View>
                        <Pressable
                          style={[
                            styles.couponApplyBtn,
                            selected && styles.couponApplyBtnSelected,
                            !canApply && styles.couponApplyBtnDisabled,
                          ]}
                          disabled={!canApply}
                          onPress={() =>
                            setSelectedCouponCode((prev) =>
                              prev === coupon.code ? null : coupon.code,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.couponApplyText,
                              selected && styles.couponApplyTextSelected,
                              !canApply && styles.couponApplyTextDisabled,
                            ]}
                          >
                            {selected ? 'Applied' : 'Apply'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {validAmount > 0 && (
              <View style={styles.creditSummary}>
                <Text style={styles.creditSummaryLabel}>Wallet will be credited</Text>
                <Text style={styles.creditSummaryValue}>
                  <Text style={styles.creditSummaryCurrency}>₹</Text>
                  {creditTotal}
                </Text>
                {extraTotal > 0 ? (
                  <Text style={styles.creditSummaryBonus}>
                    {bonusAmount > 0 && referralBonus > 0
                      ? `₹${validAmount} + ₹${bonusAmount} coupon + ₹${referralBonus} referral`
                      : referralBonus > 0
                        ? `₹${validAmount} + ₹${referralBonus} referral bonus`
                        : `₹${validAmount} + ₹${bonusAmount} bonus`}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Payment via Razorpay (dev stub in Expo Go) */}
            <View style={styles.paymentMethods}>
              <Text style={styles.paymentMethodsTitle}>Payment</Text>
              <Text style={styles.paymentMethodsHint}>
                {isExpoGo()
                  ? 'Expo Go dev mode: Add Money credits your wallet without Razorpay.'
                  : 'Pay securely with UPI, cards, or net banking via Razorpay.'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[
                styles.addMoneyCtaButton,
                (!validAmount || isToppingUp) && styles.addMoneyCtaButtonDisabled,
              ]}
              onPress={handleAddMoney}
              disabled={!validAmount || isToppingUp}
            >
              {isToppingUp ? (
                <ActivityIndicator size="small" color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.addMoneyCtaText}>
                  {validAmount ? (
                    <>
                      Add <Text style={styles.ctaCurrency}>₹</Text>
                      {validAmount}
                      {extraTotal > 0 ? (
                        <>
                          {' · Get '}
                          <Text style={styles.ctaCurrency}>₹</Text>
                          {creditTotal}
                        </>
                      ) : null}
                    </>
                  ) : (
                    'Enter Amount'
                  )}
                </Text>
              )}
            </Pressable>
          </View>
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
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  balanceCard: {
    margin: spacing.lg,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.lg.native,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  walletIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  balanceLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontFamily: fonts.poppins.bold,
    fontSize: 32,
    color: colors.brand.onPrimary,
  },
  balanceCurrency: {
    fontFamily: fonts.inter.bold,
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addMoneyText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.onPrimary,
    marginLeft: spacing.xs,
  },
  transactionsSection: {
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  seeAllText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.brand.accent,
  },
  transactionsList: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  emptyContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
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
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  modalScroll: {
    flex: 1,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  currencySymbol: {
    fontFamily: fonts.inter.bold,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text.heading,
    includeFontPadding: false,
  },
  amountInput: {
    fontFamily: fonts.poppins.bold,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text.heading,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    minWidth: 28,
    textAlign: 'left',
    includeFontPadding: false,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing['2xl'],
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
  },
  quickAmountButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.accentMuted,
  },
  quickAmountText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
  },
  quickAmountTextActive: {
    color: colors.brand.primary,
  },
  paymentMethods: {
    marginTop: spacing.lg,
  },
  paymentMethodsTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentMethodsHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 18,
  },
  couponsSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  couponsTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  couponsLoader: {
    marginVertical: spacing.sm,
  },
  couponsEmpty: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  couponRowSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.accentMuted,
  },
  couponRowDisabled: {
    opacity: 0.85,
  },
  couponText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  couponCode: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  couponLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  couponHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.status.warning.foreground,
    marginTop: 4,
  },
  couponApplyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.elevated,
  },
  couponApplyBtnSelected: {
    backgroundColor: colors.brand.primary,
  },
  couponApplyBtnDisabled: {
    borderColor: colors.border.default,
    backgroundColor: colors.surface.background,
  },
  couponApplyText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.primary,
  },
  couponApplyTextSelected: {
    color: colors.brand.onPrimary,
  },
  couponApplyTextDisabled: {
    color: colors.text.muted,
  },
  creditSummary: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  creditSummaryLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
  },
  creditSummaryValue: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 22,
    color: colors.text.heading,
    marginTop: 4,
  },
  creditSummaryCurrency: {
    fontFamily: fonts.inter.bold,
  },
  creditSummaryBonus: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.status.success.foreground,
    marginTop: 4,
  },
  modalFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  addMoneyCtaButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.button.native,
  },
  addMoneyCtaButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  addMoneyCtaText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  ctaCurrency: {
    fontFamily: fonts.inter.bold,
  },
});
