const fs = require('fs');
const path = require('path');

// Monorepo-safe: always load .env from this app directory
require('@expo/env').load(path.resolve(__dirname));

const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...appJson.expo,
  android: { ...appJson.expo.android },
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
