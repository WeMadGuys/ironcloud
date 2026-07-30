import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@ironcloud/ui';

import type { PromoBanner } from '../services/banners.service';

type Props = {
  banner: PromoBanner;
  onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function PromoBannerModal({ banner, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const handleLinkPress = async () => {
    if (!banner.link) return;
    try {
      const canOpen = await Linking.canOpenURL(banner.link);
      if (canOpen) await Linking.openURL(banner.link);
    } catch {
      // Ignore link failures; closing still counts as an impression.
    }
    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + spacing.sm }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close banner"
        >
          <MaterialCommunityIcons name="close" size={22} color={colors.text.inverse} />
        </Pressable>

        <View style={styles.card}>
          {imageFailed ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>{banner.title}</Text>
              <Pressable style={styles.fallbackClose} onPress={onClose}>
                <Text style={styles.fallbackCloseText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              disabled={!banner.link}
              onPress={banner.link ? handleLinkPress : undefined}
              accessibilityRole={banner.link ? 'link' : undefined}
            >
              {!imageLoaded && (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.brand.primary} />
                </View>
              )}
              <Image
                source={{ uri: banner.imageUrl }}
                style={[styles.image, !imageLoaded && styles.imageHidden]}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageFailed(true);
                  setImageLoaded(true);
                }}
                accessibilityLabel={banner.title}
              />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: Math.min(SCREEN_WIDTH - spacing.lg * 2, 420),
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface.elevated,
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: Math.min(SCREEN_HEIGHT * 0.65, 520),
  },
  imageHidden: {
    position: 'absolute',
    opacity: 0,
  },
  fallback: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  fallbackTitle: {
    ...typography.title,
    color: colors.text.heading,
    textAlign: 'center',
  },
  fallbackClose: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primary,
  },
  fallbackCloseText: {
    ...typography.button,
    color: colors.brand.onPrimary,
  },
});
