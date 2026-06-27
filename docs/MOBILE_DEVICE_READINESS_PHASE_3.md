# Phase 3: Mobile Device Readiness

Last updated: 06/27/2026

## Goal

Move from web-preview confidence to real mobile confidence:

- Build an Android staging APK.
- Test the staging app on a real Android phone.
- Plan the iOS preview path.
- Capture and fix responsive layout issues found on real phones.
- Make native feature limitations clear before production.

## Current Status

| Pass | Status | Notes |
|---|---|---|
| Android staging build | Blocked | EAS CLI is not logged in and `apps/mobile/app.json` still has `REPLACE_WITH_EAS_PROJECT_ID`. |
| Real Android phone testing | Not started | Requires Android staging APK first. |
| iOS preview planning | Ready to plan | Requires Apple Developer account and EAS project linking before build. |
| Responsive layout fixes | Started | Web/mobile UI has been polished, but real-phone issues must be logged from physical devices. |
| Camera/payment/notification limitations | Documented | No camera module is currently installed; Stripe and push notifications require native-build testing. |

## Preflight Result

Command run:

```powershell
npm run mobile:readiness:staging
```

Result:

- Passed: `apps/mobile/app.json` exists.
- Passed: `apps/mobile/eas.json` exists.
- Passed: Android package is `com.laundryapp.mobile`.
- Passed: iOS bundle id is `com.laundryapp.mobile`.
- Passed: staging env values are present and point to `laundryapp-staging`.
- Passed: EAS `preview` profile exists.
- Passed: Android staging profile builds an APK.
- Blocked: EAS project id is not linked.
- Warning: EAS CLI is not logged in.

## What You Need To Do Before Android Build

### 1. Log In To EAS

From repo root:

```powershell
cd apps/mobile
npx eas-cli login
```

Use your Expo account credentials.

Confirm login:

```powershell
npx eas-cli whoami
```

### 2. Link The App To An EAS Project

From `apps/mobile`:

```powershell
npx eas-cli init
```

Expected result:

- EAS creates or links an Expo project.
- `apps/mobile/app.json` gets a real `extra.eas.projectId`.
- The placeholder `REPLACE_WITH_EAS_PROJECT_ID` is removed.

### 3. Configure Staging Environment Values For EAS Cloud Builds

The local file `apps/mobile/.env.staging` works for local previews, but EAS cloud builds also need staging values available in EAS.

Values needed:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Use staging/test values only for the preview build.

### 4. Rerun Mobile Readiness

From repo root:

```powershell
npm run mobile:readiness:staging
```

Expected result:

- No failures.
- EAS login confirmed.
- EAS project id linked.

## Android Staging APK Build

After preflight passes:

```powershell
npm run mobile:build:android:staging
```

Expected result:

- EAS creates an Android internal APK build.
- You receive an install/download link.
- The installed app shows the staging environment banner.

## Real Android Phone Test Checklist

Use a real Android phone and the staging APK.

| Role | Test |
|---|---|
| Customer | Sign in, create order, save address, review order, submit order, open tracking, view rewards/payment method pages. |
| Owner | View dashboard, use attention tiles, accept/decline order, save final price, finalize payment status, create pickup batch, create delivery batch. |
| Driver | Open assigned route, view address, select/unselect stop, finalize route, reopen completed route and confirm finalize button is gone. |
| Admin | View users, search users, open permissions, open audit logs, open demo control center, confirm staging-only tools are clearly labeled. |
| Wrong-role access | Try direct navigation to pages outside each role and confirm redirect/block behavior. |

## Responsive Layout Areas To Watch

These are the pages most likely to reveal phone-specific issues:

- New Order long form.
- Sticky estimated cost box.
- Order Review page.
- Owner Orders grid and filters.
- Manage Order page.
- Batch Management eligible orders and assigned batches.
- Driver route detail and route finalize page.
- Business Configuration.
- Reports and analytics modals.
- Admin User Management and Audit Logs.

Log each issue with:

- Device model.
- Android version.
- Role.
- Page.
- Steps to reproduce.
- Screenshot or short screen recording.

## iOS Preview Planning

Not blocked by Android work, but it requires more setup:

- Apple Developer account.
- EAS project linked.
- iOS bundle id confirmed: `com.laundryapp.mobile`.
- Apple credentials configured through EAS.
- Internal iPhone distribution path selected.

Expected future command:

```powershell
cd apps/mobile
npx eas-cli build --profile preview --platform ios
```

## Native Feature Limitations

### Camera

Current status: no camera module is installed and no camera workflow exists.

Meaning:

- The app should not request camera permission.
- If future proof-of-pickup/delivery photos are desired, that should be a separate module.

### Payments

Current status:

- Stripe React Native SDK is installed.
- Real Stripe payment processing has not been implemented yet.
- Payment finalization in the app is still operational/demo workflow, not real card charging.

Meaning:

- Do not enter real card data.
- Real saved payment methods, receipts, refunds, and reward redemption against payment should wait for the Stripe module.

### Push Notifications

Current status:

- Expo Notifications is installed.
- Native push behavior must be tested on an Android/iOS build, not web preview.

Meaning:

- Web preview cannot prove real push notifications.
- Real builds must confirm notification permission, token saving, and tap-to-open behavior.

## Phase 3 Result

Phase 3 is ready to continue once EAS login and EAS project linking are completed. The codebase has a repeatable mobile readiness preflight, and the Android staging APK is the next concrete build step.
