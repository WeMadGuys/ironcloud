import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={handleClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={24} color={colors.icon.primary} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            style={styles.headerBtn}
            onPress={() => setManualMode((v) => !v)}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={manualMode ? 'qrcode-scan' : 'keyboard-outline'}
              size={22}
              color={colors.icon.primary}
            />
          </Pressable>
        </View>

        {manualMode ? (
          <View style={styles.manualWrap}>
            <Text style={styles.hint}>Enter box code (e.g. AH-001)</Text>
            <TextInput
              style={styles.input}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="BOX CODE"
              placeholderTextColor={colors.text.muted}
              editable={!busy && !locked}
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
              <Pressable style={styles.secondaryBtn} onPress={handleRescan}>
                <Text style={styles.secondaryBtnText}>Enter another</Text>
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
            <Pressable style={styles.secondaryBtn} onPress={() => setManualMode(true)}>
              <Text style={styles.secondaryBtnText}>Enter code manually</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
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
              <View style={styles.busyOverlay}>
                <ActivityIndicator color={colors.brand.onPrimary} size="large" />
              </View>
            ) : null}
            {locked && !busy ? (
              <Pressable style={styles.rescanFab} onPress={handleRescan}>
                <Text style={styles.rescanFabText}>Scan again</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  loader: { marginTop: spacing['2xl'] },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
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
  rescanFab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    alignSelf: 'center',
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  rescanFabText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
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
  secondaryBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  btnDisabled: { opacity: 0.6 },
});
