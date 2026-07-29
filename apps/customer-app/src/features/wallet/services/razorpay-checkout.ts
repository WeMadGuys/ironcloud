export type RazorpayCheckoutPrefill = {
  name?: string;
  email?: string;
  contact?: string;
};

export type RazorpayCheckoutInput = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  description: string;
  prefill?: RazorpayCheckoutPrefill;
};

export type RazorpayCheckoutResult = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

export async function openRazorpayCheckout(
  _input: RazorpayCheckoutInput,
): Promise<RazorpayCheckoutResult> {
  throw new Error(
    'Razorpay checkout is only available in the native customer app (iOS/Android dev build).',
  );
}
