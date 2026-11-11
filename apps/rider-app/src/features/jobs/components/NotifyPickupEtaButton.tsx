import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@ironcloud/ui';

import { notifyCustomerPickupEta } from '../services/pickup-eta.service';

type Props = {
  orderId: string;
};

export function NotifyPickupEtaButton({ orderId }: Props) {
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await notifyCustomerPickupEta(orderId);
      Alert.alert('Customer notified', "They're asked to keep the clothes ready.");
    } catch (error) {
      Alert.alert(
        'Not sent',
        error instanceof Error ? error.message : 'Could not send the notification.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, sending && styles.buttonBusy]}
      disabled={sending}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Tell the customer you are 5 to 10 minutes away"
      onPress={() => {
        Alert.alert(
          'Notify customer?',
          "We'll tell them you're 5–10 minutes away and to keep the clothes ready.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: () => void send() },
          ],
        );
      }}
    >
      {sending ? (
        <ActivityIndicator size="small" color={colors.brand.primary} />
      ) : (
        <MaterialCommunityIcons name="bell-ring-outline" size={18} color={colors.brand.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonBusy: { opacity: 0.7 },
});
