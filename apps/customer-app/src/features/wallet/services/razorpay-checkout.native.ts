import RazorpayCheckout from 'react-native-razorpay';

import type {
  RazorpayCheckoutInput,
  RazorpayCheckoutResult,
} from './razorpay-checkout';

export async function openRazorpayCheckout(
  input: RazorpayCheckoutInput,
): Promise<RazorpayCheckoutResult> {
  const data = await RazorpayCheckout.open({
    description: input.description,
    currency: input.currency,
    key: input.keyId,
    amount: input.amountPaise,
    order_id: input.orderId,
    name: 'IronCloud',
    prefill: {
      name: input.prefill?.name,
      email: input.prefill?.email,
      contact: input.prefill?.contact,
    },
    theme: { color: '#1E3A5F' },
  });

  return {
    razorpayPaymentId: data.razorpay_payment_id,
    razorpayOrderId: data.razorpay_order_id,
    razorpaySignature: data.razorpay_signature,
  };
}

export type { RazorpayCheckoutInput, RazorpayCheckoutResult };
