import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  cancelDeliveryPayment,
  pollDeliveryPayment,
  quoteDeliveryPayment,
  startDeliveryPayment,
} from '../services/delivery-payment.service';

type Props = {
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onPaid: () => Promise<void>;
};

type Phase = 'loading' | 'choose' | 'qr';

type Session = {
  id: string;
  walletAmount: number;
  qrAmount: number;
  qrImageUrl: string | null;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

function formatRupee(amount: number): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? `₹${rounded}` : `₹${rounded.toFixed(2)}`;
}

/** Matches splitDeliveryAmount on the server. The server still decides the charge. */
function previewSplit(total: number, balance: number, useWallet: boolean) {
  const safeTotal = Math.max(0, Math.round((total + Number.EPSILON) * 100) / 100);
  const safeBalance = Math.max(0, Math.round((balance + Number.EPSILON) * 100) / 100);
  const walletAmount = useWallet
    ? Math.round((Math.min(safeBalance, safeTotal) + Number.EPSILON) * 100) / 100
    : 0;
  const qrAmount = Math.round((safeTotal - walletAmount + Number.EPSILON) * 100) / 100;
  return { walletAmount, qrAmount };
}

export function DeliveryPaymentSheet({ visible, orderId, onClose, onPaid }: Props) {
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const [phase, setPhase] = useState<Phase>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [useScanner, setUseScanner] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paidReady, setPaidReady] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const finishing = useRef(false);

  const completePaid = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setPaidReady(true);
    setError(null);
    try {
      await onPaidRef.current();
    } catch (err) {
      finishing.current = false;
      setError(err instanceof Error ? err.message : 'Could not confirm delivery');
    }
  };

  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;

    const load = async () => {
      finishing.current = false;
      setPhase('loading');
      setError(null);
      setPaidReady(false);
      setQuoteReady(false);
      setSession(null);
      try {
        const quote = await quoteDeliveryPayment(orderId);
        if (cancelled) return;
        setTotal(quote.totalAmount);
        setBalance(quote.walletBalance);

        const finish = async () => {
          setQuoteReady(true);
          await completePaid();
        };

        if (quote.paymentStatus === 'paid') {
          await finish();
          return;
        }

        if (quote.pending?.id) {
          if (quote.pending.qrAmount > 0 && quote.pending.qrImageUrl) {
            setSession({
              id: quote.pending.id,
              walletAmount: quote.pending.walletAmount,
              qrAmount: quote.pending.qrAmount,
              qrImageUrl: quote.pending.qrImageUrl,
            });
            setQuoteReady(true);
            setPhase('qr');
            return;
          }
          const started = await startDeliveryPayment(
            orderId,
            quote.pending.walletAmount > 0,
            quote.pending.qrAmount > 0,
          );
          if (cancelled) return;
          if (started.paid) {
            await finish();
            return;
          }
          if (started.status !== 'pending_qr' || started.qrAmount <= 0 || !started.collectionId) {
            throw new Error('Payment was not completed. Choose again.');
          }
          setSession({
            id: started.collectionId,
            walletAmount: started.walletAmount,
            qrAmount: started.qrAmount,
            qrImageUrl: started.qrImageUrl,
          });
          setQuoteReady(true);
          setPhase('qr');
          return;
        }

        const hasWallet = quote.walletBalance > 0;
        const covers = hasWallet && quote.walletBalance >= quote.totalAmount;
        setUseWallet(hasWallet);
        setUseScanner(!covers);
        setQuoteReady(true);
        setPhase('choose');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load payment options.');
        setPhase('choose');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [visible, orderId, reloadKey]);

  useEffect(() => {
    if (!visible || phase !== 'qr' || !session?.id) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const result = await pollDeliveryPayment(orderId, session.id);
        if (stopped) return;
        if (result.qrImageUrl) {
          setSession((current) =>
            current && current.qrImageUrl !== result.qrImageUrl
              ? { ...current, qrImageUrl: result.qrImageUrl }
              : current,
          );
        }
        if (result.paid) {
          stopped = true;
          await completePaid();
          return;
        }
        if (result.status === 'expired' || result.status === 'cancelled') {
          stopped = true;
          setError(
            result.status === 'expired'
              ? 'Scanner expired. Any wallet amount was returned. Choose again.'
              : 'Payment was cancelled. Choose again.',
          );
          setReloadKey((key) => key + 1);
        }
      } catch {
        // Keep the scanner open. The next poll retries.
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), 3000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void tick();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [visible, phase, session?.id, orderId]);

  const split = previewSplit(total, balance, useWallet && balance > 0);
  const scannerTooSmall = split.qrAmount > 0 && split.qrAmount < 1;
  const needsScanner = split.qrAmount > 0;
  const canCollect =
    quoteReady &&
    !busy &&
    !paidReady &&
    (useWallet || useScanner) &&
    (!needsScanner || useScanner) &&
    !scannerTooSmall;

  const finishPaid = async () => {
    setBusy(true);
    try {
      await completePaid();
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    if (!canCollect) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startDeliveryPayment(orderId, useWallet && balance > 0, useScanner);
      if (result.paid) {
        await completePaid();
        return;
      }
      if (result.status !== 'pending_qr' || result.qrAmount <= 0 || !result.collectionId) {
        throw new Error('Payment was not completed. Choose again.');
      }
      setSession({
        id: result.collectionId,
        walletAmount: result.walletAmount,
        qrAmount: result.qrAmount,
        qrImageUrl: result.qrImageUrl,
      });
      setPhase('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment');
    } finally {
      setBusy(false);
    }
  };

  const cancelScanner = async () => {
    if (!session?.id) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await cancelDeliveryPayment(orderId, session.id);
      if (result.paid) {
        await completePaid();
        return;
      }
      setSession(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the scanner');
    } finally {
      setBusy(false);
    }
  };

  const requestClose = () => {
    if (paidReady) {
      void finishPaid();
      return;
    }
    if (phase === 'qr' && session) {
      Alert.alert(
        'Leave this scanner?',
        'The code stays open. Use Change method to return the wallet amount and pick again.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', onPress: onClose },
        ],
      );
      return;
    }
    onClose();
  };

  const summary = !quoteReady
    ? ''
    : split.walletAmount > 0 && split.qrAmount > 0 && useScanner
      ? `Wallet ${formatRupee(split.walletAmount)} + Scanner ${formatRupee(split.qrAmount)}`
      : split.walletAmount > 0 && !needsScanner
        ? `Wallet ${formatRupee(split.walletAmount)}`
        : useScanner
          ? `Scanner ${formatRupee(split.qrAmount)}`
          : 'Select a way to collect';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={requestClose} accessibilityRole="button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
          </Pressable>
          <Text style={styles.title}>Collect payment</Text>
          <View style={styles.iconBtn} />
        </View>

        {phase === 'loading' ? (
          <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
        ) : phase === 'qr' && session ? (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.due}>Scanner {formatRupee(session.qrAmount)}</Text>
            {session.walletAmount > 0 ? (
              <Text style={styles.hint}>
                Wallet {formatRupee(session.walletAmount)} is already applied. The customer scans
                this code for the rest.
              </Text>
            ) : (
              <Text style={styles.hint}>Ask the customer to scan this code in any UPI app.</Text>
            )}
            {session.qrImageUrl ? (
              <Image
                source={{ uri: session.qrImageUrl }}
                style={styles.qr}
                resizeMode="contain"
                accessibilityLabel={`Payment QR for ${formatRupee(session.qrAmount)}`}
              />
            ) : (
              <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
            )}
            <Text style={styles.waiting}>Waiting for payment…</Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.due}>Due {formatRupee(total)}</Text>
            <Text style={styles.hint}>
              Both can be used together. The scanner collects only what the wallet does not cover.
            </Text>

            <Pressable
              style={[styles.option, useWallet && balance > 0 && styles.optionOn, balance <= 0 && styles.optionOff]}
              disabled={balance <= 0 || busy}
              onPress={() => setUseWallet((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useWallet && balance > 0, disabled: balance <= 0 }}
            >
              <MaterialCommunityIcons
                name={useWallet && balance > 0 ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={balance <= 0 ? colors.text.disabled : colors.brand.primary}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Wallet ({formatRupee(balance)})</Text>
                <Text style={styles.optionSub}>
                  {balance <= 0 ? 'No balance in the customer wallet' : 'Use the customer wallet'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.option, useScanner && styles.optionOn]}
              disabled={busy}
              onPress={() => setUseScanner((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useScanner }}
            >
              <MaterialCommunityIcons
                name={useScanner ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={colors.brand.primary}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Scanner</Text>
                <Text style={styles.optionSub}>Customer scans a UPI code on this phone</Text>
              </View>
            </Pressable>

            {quoteReady ? <Text style={styles.summary}>{summary}</Text> : null}
            {needsScanner && !useScanner ? (
              <Text style={styles.warn}>
                Select scanner for the remaining {formatRupee(split.qrAmount)}.
              </Text>
            ) : null}
            {scannerTooSmall ? (
              <Text style={styles.warn}>Scanner amount must be at least ₹1.</Text>
            ) : null}
            {useScanner && split.qrAmount <= 0 && quoteReady ? (
              <Text style={styles.hint}>Wallet covers the full bill. Scanner will not open.</Text>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.footer}>
          {error ? <Text style={styles.warn}>{error}</Text> : null}
          {paidReady ? (
            <Pressable style={styles.primary} onPress={() => void finishPaid()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.primaryText}>Finish delivery</Text>
              )}
            </Pressable>
          ) : phase === 'qr' ? (
            <Pressable
              style={[styles.secondary, busy && styles.disabled]}
              onPress={() => void cancelScanner()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.text.heading} />
              ) : (
                <Text style={styles.secondaryText}>Change method</Text>
              )}
            </Pressable>
          ) : phase === 'choose' && !quoteReady ? (
            <Pressable style={styles.primary} onPress={() => setReloadKey((key) => key + 1)}>
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          ) : phase === 'choose' ? (
            <Pressable
              style={[styles.primary, !canCollect && styles.disabled]}
              onPress={() => void collect()}
              disabled={!canCollect}
            >
              {busy ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.primaryText}>
                  {split.qrAmount > 0 && useScanner ? 'Open scanner' : 'Collect payment'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  loader: { marginTop: spacing['2xl'] },
  body: { padding: spacing.lg, paddingBottom: spacing['2xl'], gap: spacing.md },
  due: {
    fontFamily: fonts.poppins.bold,
    fontSize: 22,
    color: colors.text.heading,
  },
  hint: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
  },
  optionOn: { borderColor: colors.brand.primary },
  optionOff: { opacity: 0.55 },
  optionText: { flex: 1 },
  optionTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  optionSub: {
    marginTop: 2,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
  summary: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  waiting: {
    textAlign: 'center',
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
  },
  qr: {
    width: '72%',
    maxWidth: 280,
    aspectRatio: 1,
    alignSelf: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  primary: {
    backgroundColor: colors.status.success.foreground,
    borderRadius: radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  primaryText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  secondary: {
    borderRadius: radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  secondaryText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  disabled: { opacity: 0.55 },
  warn: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.status.error.text,
  },
});
