# Store release checklist (customer + rider)

Use this before TestFlight / Play internal testing / App Store / Play Store submit.

## 1. Production API (Vercel)

- Admin + APIs: https://ironcloud-rho.vercel.app
- On Vercel **Production** env:
  - Do **not** set `ALLOW_DEV_WALLET_TOPUP=true` (code also hard-blocks when `VERCEL_ENV` / `NODE_ENV` is production).
  - Set Razorpay live or test keys as intended: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
  - Set `MSG91_AUTHKEY`, Supabase URL/anon/service role.

Local Expo Go stub top-up still works only against `npm run web:dev` with `ALLOW_DEV_WALLET_TOPUP=true`.

## 2. Auth (MSG91 only in release)

- Release / EAS builds **always** use MSG91 (`__DEV__` false), even if `EXPO_PUBLIC_AUTH_PROVIDER=mock` is set.
- Local Expo Go may use `EXPO_PUBLIC_AUTH_PROVIDER=mock` (OTP `1234`).
- EAS profiles set `EXPO_PUBLIC_AUTH_PROVIDER=msg91`.
- Confirm MSG91 widget IDs are present in EAS secrets / env:
  - `EXPO_PUBLIC_MSG91_WIDGET_ID`
  - `EXPO_PUBLIC_MSG91_TOKEN_AUTH`

## 3. Razorpay + EAS (not Expo Go)

`react-native-razorpay` needs a custom native build.

1. Replace `extra.eas.projectId` in `apps/customer-app/app.json` (run `eas init` in that app).
2. Set EAS secrets / env for preview + production:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_URL=https://ironcloud-rho.vercel.app`
   - `EXPO_PUBLIC_RAZORPAY_KEY_ID` (same key id as server)
   - MSG91 public vars above
3. Install / link once: `npx expo install expo-dev-client` in customer-app (for development profile).
4. Build:
   - Android internal: `cd apps/customer-app && eas build --profile preview --platform android`
   - iOS TestFlight: `eas build --profile preview --platform ios` then `eas submit`
5. Verify wallet: Add Money → Razorpay UI → balance updates. Cancel payment must not crash.

`newArchEnabled` is `false` in app.json because Razorpay RN is unreliable on New Architecture (Expo 54).

## 4. Crash-free review path

Reviewers typically: login → onboard → home (book or empty slots) → wallet → logout.

Empty states already cover:
- No communities (onboarding search)
- No / expired slots (home)
- No orders / wallet transactions

Confirm on a build with a community that has **no** pickup slots configured.

## 5. App Privacy / Data Safety (store consoles)

Answer forms to match the app:

| Data | Customer app | Declare |
|------|--------------|---------|
| Phone number | MSG91 login | Yes |
| Photos / Camera | Profile avatar (`expo-image-picker`) | Yes |
| Payment info | Razorpay wallet top-up | Yes |
| Location | Not used in customer app today | No (unless you add it) |

Rider app: declare phone (+ location only if you collect it).

## 6. Demo / App Review login

Apple often needs a login that does not depend on the reviewer’s SMS.

Recommended:
1. In MSG91, whitelist a dedicated review phone (or use MSG91 test numbers).
2. Put in App Review notes, e.g.:

```text
Demo account
Phone: +91XXXXXXXXXX
OTP: (provided by MSG91 test/whitelist — paste the fixed OTP you configured)

Flow: Login → complete onboarding if prompted → Home → Wallet → Profile → Logout.
If no pickup slots appear, that is expected for this demo community.
```

Do **not** ship mock OTP `1234` in store builds (already blocked in code).

## Dependency order

1. Disable prod free top-up (Vercel) → done in code + env
2. MSG91 in release → done in code + EAS env
3. EAS + Razorpay native → build & device test (manual)
4. Empty-state pass → done in UI
5. Privacy forms → console (manual)
6. Review phone notes → MSG91 + App Store Connect (manual)
