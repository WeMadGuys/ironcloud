import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onScan: (code: string) => void;
  busy?: boolean;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

export function BoxQrScanner({
  visible,
  title = 'Scan Box QR',
  onClose,
  onScan,
  busy = false,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocked(false);
      setManualCode('');
      setManualMode(false);
    }
  }, [visible]);

  const emitCode = useCallback(
    (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code || locked || busy) return;
      setLocked(true);
      onScan(code);
    },
    [busy, locked, onScan],
  );

  const handleClose = () => {
    setLocked(false);
    setManualCode('');
    setManualMode(false);
    onClose();
  };

  const handleRescan = () => {
    setLocked(false);
    setManualCode('');
  };

  const toggleManualMode = () => {
    setManualMode((current) => {
      const next = !current;
      if (next) {
        setLocked(false);
      }
      return next;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          {manualMode ? (
            <View style={styles.manualWrap}>
              <Text style={styles.hint}>Enter box code (e.g. AH-001)</Text>
              <TextInput
                style={styles.input}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                placeholder="BOX CODE"
                placeholderTextColor={colors.text.muted}
                editable={!busy && !locked}
                returnKeyType="done"
                onSubmitEditing={() => emitCode(manualCode)}
              />
              <Pressable
                style={[styles.primaryBtn, (!manualCode.trim() || busy || locked) && styles.btnDisabled]}
                disabled={!manualCode.trim() || busy || locked}
                onPress={() => emitCode(manualCode)}
              >
                {busy ? (
                  <ActivityIndicator color={colors.brand.onPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Look up box</Text>
                )}
              </Pressable>
              {locked ? (
                <Pressable style={styles.textBtn} onPress={handleRescan}>
                  <Text style={styles.textBtnLabel}>Enter another</Text>
                </Pressable>
              ) : null}
            </View>
          ) : !permission ? (
            <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
          ) : !permission.granted ? (
            <View style={styles.manualWrap}>
              <Text style={styles.hint}>Camera permission is required to scan box QR codes.</Text>
              <Pressable style={styles.primaryBtn} onPress={() => void requestPermission()}>
                <Text style={styles.primaryBtnText}>Grant camera access</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={
                  locked || busy
                    ? undefined
                    : (event: { data: string }) => emitCode(event.data)
                }
              />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.frame} />
                <Text style={styles.overlayHint}>
                  {locked ? 'Code captured' : 'Point at the box QR sticker'}
                </Text>
              </View>
              {busy ? (
                <View style={styles.busyOverlay} pointerEvents="none">
                  <ActivityIndicator color={colors.brand.onPrimary} size="large" />
                </View>
              ) : null}
            </View>
          )}
        </View>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Text style={styles.footerTitle}>{title}</Text>
          {locked && !manualMode && !busy ? (
            <Pressable style={styles.secondaryBtn} onPress={handleRescan}>
              <Text style={styles.secondaryBtnText}>Scan again</Text>
            </Pressable>
          ) : null}
          <View style={styles.footerRow}>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <MaterialCommunityIcons name="close" size={20} color={colors.text.heading} />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
            <Pressable style={styles.keypadBtn} onPress={toggleManualMode}>
              <MaterialCommunityIcons
                name={manualMode ? 'qrcode-scan' : 'keyboard-outline'}
                size={20}
                color={colors.brand.onPrimary}
              />
              <Text style={styles.keypadBtnText}>{manualMode ? 'Scan QR' : 'Keypad'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  body: { flex: 1 },
  loader: { marginTop: spacing['2xl'] },
  cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  frame: {
    width: '68%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.brand.onPrimary,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  overlayHint: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.brand.onPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualWrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  hint: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.inter.semibold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.text.heading,
    backgroundColor: colors.surface.elevated,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  textBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  textBtnLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  btnDisabled: { opacity: 0.6 },
  footer: {
    backgroundColor: colors.surface.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  footerTitle: {
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
  },
  closeBtnText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  keypadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.primary,
  },
  keypadBtnText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  secondaryBtnText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
});
