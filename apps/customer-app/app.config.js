const fs = require('fs');
const path = require('path');

const { withAndroidManifest } = require('@expo/config-plugins');

// Monorepo-safe: always load .env from this app directory
require('@expo/env').load(path.resolve(__dirname));

const appJson = require('./app.json');

// Razorpay's top UPI apps that exist on both iOS and Android.
// Tata Neu is 6th on Android only, so Amazon Pay is the shared sixth.
const UPI_APPS = [
  { iosScheme: 'tez', androidPackage: 'com.google.android.apps.nbu.paisa.user' },
  { iosScheme: 'phonepe', androidPackage: 'com.phonepe.app' },
  { iosScheme: 'paytmmp', androidPackage: 'net.one97.paytm' },
  { iosScheme: 'credpay', androidPackage: 'com.dreamplug.androidapp' },
  { iosScheme: 'bhim', androidPackage: 'in.org.npci.upiapp' },
  { iosScheme: 'amazonpay', androidPackage: 'in.amazon.mShop.android.shopping' },
];

/** Lets Android 11+ see these UPI apps so Razorpay Checkout can list them. */
function withUpiAppQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries ?? [];
    manifest.queries.push({
      package: UPI_APPS.map((app) => ({ $: { 'android:name': app.androidPackage } })),
    });
    return config;
  });
}

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...appJson.expo,
  android: { ...appJson.expo.android },
  ios: {
    ...appJson.expo.ios,
    infoPlist: {
      ...appJson.expo.ios?.infoPlist,
      LSApplicationQueriesSchemes: UPI_APPS.map((app) => app.iosScheme),
    },
  },
  plugins: [...(appJson.expo.plugins ?? []), withUpiAppQueries],
};

const localGoogleServices = path.join(__dirname, 'google-services.json');
const easGoogleServices = process.env.GOOGLE_SERVICES_JSON;
const googleServicesFile =
  (easGoogleServices && fs.existsSync(easGoogleServices) && easGoogleServices) ||
  (fs.existsSync(localGoogleServices) ? './google-services.json' : null);

const isEasAndroid =
  process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android';

if (isEasAndroid && !googleServicesFile) {
  throw new Error(
    '[IronCloud] google-services.json is missing. Android Expo push tokens cannot be created without FCM. ' +
      'Firebase Console → add Android app com.ironcloud.app → download google-services.json → ' +
      'place it at apps/customer-app/google-services.json → rebuild preview.',
  );
}

if (googleServicesFile) {
  config.android.googleServicesFile = googleServicesFile;
}

module.exports = { expo: config };
