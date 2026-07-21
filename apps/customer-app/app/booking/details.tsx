import { Redirect } from 'expo-router';

/** Booking status now lives on Home — keep this route for old links. */
export default function BookingDetailsScreen() {
  return <Redirect href="/(tabs)/home" />;
}
