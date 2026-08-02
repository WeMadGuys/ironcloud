import type {
  RazorpayCheckoutInput,
  RazorpayCheckoutResult,
} from './razorpay-checkout';

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayModule = {
  open: (options: Record<string, unknown>) => Promise<RazorpaySuccess>;
};

/**
 * Opens native Razorpay checkout.
 * Uses a lazy require so Expo Go never loads the native module
 * (wallet.service routes Expo Go to the server stub instead).
 */
export async function openRazorpayCheckout(
  input: RazorpayCheckoutInput,
): Promise<RazorpayCheckoutResult> {
  let RazorpayCheckout: RazorpayModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require('react-native-razorpay').default as RazorpayModule;
  } catch {
    throw new Error(
      'Razorpay native module is unavailable. Use an EAS/dev client build (not Expo Go).',
    );
  }

  if (!RazorpayCheckout?.open) {
    throw new Error(
      'Razorpay native module failed to load. Rebuild with EAS or expo run:android / run:ios.',
    );
  }

  const data = await RazorpayCheckout.open({
    key: input.keyId,
    order_id: input.orderId,
    amount: String(input.amountPaise),
    currency: input.currency,
    name: 'IronCloud',
    description: input.description,
    prefill: {
      name: input.prefill?.name,
      email: input.prefill?.email,
      contact: input.prefill?.contact,
    },
    theme: { color: '#0B6E4F' },
  });

  if (
    !data?.razorpay_payment_id ||
    !data?.razorpay_order_id ||
    !data?.razorpay_signature
  ) {
    throw new Error('Incomplete Razorpay payment response.');
  }

  return {
    razorpayPaymentId: data.razorpay_payment_id,
    razorpayOrderId: data.razorpay_order_id,
    razorpaySignature: data.razorpay_signature,
  };
}

export type { RazorpayCheckoutInput, RazorpayCheckoutResult };
