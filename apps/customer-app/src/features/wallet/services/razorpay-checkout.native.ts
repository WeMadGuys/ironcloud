// react-native-razorpay requires a native dev build and breaks Expo Go.
// Uncomment when using `npx expo run:android` / `run:ios`:
//
// import RazorpayCheckout from 'react-native-razorpay';

import type {
  RazorpayCheckoutInput,
  RazorpayCheckoutResult,
} from './razorpay-checkout';

export async function openRazorpayCheckout(
  _input: RazorpayCheckoutInput,
): Promise<RazorpayCheckoutResult> {
  throw new Error(
    'Razorpay native checkout is disabled for Expo Go. Use a dev build or the Expo Go wallet bypass.',
  );
}

export type { RazorpayCheckoutInput, RazorpayCheckoutResult };
