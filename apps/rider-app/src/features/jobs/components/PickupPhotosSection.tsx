import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  listPickupPhotos,
  removePickupPhoto,
  uploadPickupPhoto,
  type PickupPhoto,
} from '../services/pickup-photos.service';

type Props = {
  orderId: string;
  refreshKey?: number;
};

export function PickupPhotosSection({ orderId, refreshKey = 0 }: Props) {
  const [photos, setPhotos] = useState<PickupPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listPickupPhotos(orderId);
      setPhotos(rows);
    } catch (error) {
      Alert.alert(
        'Photos unavailable',
        error instanceof Error ? error.message : 'Could not load pickup photos',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const takePhoto = async () => {
    if (busy) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera permission needed',
        'Allow camera access to photograph the clothes at pickup.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      const photo = await uploadPickupPhoto(
        orderId,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setPhotos((prev) => [...prev, photo]);
    } catch (error) {
      Alert.alert(
        'Photo not saved',
        error instanceof Error ? error.message : 'Could not upload the photo',
      );
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (photo: PickupPhoto) => {
    Alert.alert('Remove photo?', 'This picture will be deleted from the order.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await removePickupPhoto(photo.path);
              setPhotos((prev) => prev.filter((row) => row.path !== photo.path));
            } catch (error) {
              Alert.alert(
                'Could not remove photo',
                error instanceof Error ? error.message : 'Try again',
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Photos</Text>
      <Text style={styles.hint}>
        Optional. Photograph the clothes while picking them up. You can open them again from
        View until the order is delivered, then they are deleted.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.path} style={styles.thumbWrap}>
              <Image source={{ uri: photo.url }} style={styles.thumb} />
              <Pressable
                style={styles.removeBtn}
                onPress={() => removePhoto(photo)}
                disabled={busy}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <MaterialCommunityIcons name="close" size={14} color={colors.brand.onPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        style={[styles.cameraBtn, busy && styles.cameraBtnDisabled]}
        onPress={() => void takePhoto()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Take a photo of the clothes"
      >
        {busy ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="camera" size={20} color={colors.brand.primary} />
            <Text style={styles.cameraText}>Camera</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  title: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  hint: {
    marginTop: 4,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.muted,
  },
  loader: { marginTop: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  thumbWrap: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface.background,
  },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text.heading,
  },
  cameraBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cameraBtnDisabled: { opacity: 0.6 },
  cameraText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.primary,
  },
});
