# Phase 11 Deployment and Launch Prep

This phase prepares the app for production deployment. It does not submit the app
to stores yet; it creates the checklist and configuration needed to do that
cleanly.

## Mobile Builds

Mobile app path:

```bash
cd apps/mobile
```

Build profiles are configured in:

```text
apps/mobile/eas.json
```

Recommended commands:

```bash
eas login
eas build:configure
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform all
```

Current app identifiers:

- iOS bundle id: `com.laundryapp.mobile`
- Android package: `com.laundryapp.mobile`

Replace those before production if the business has a final domain or brand.

## Required Mobile Environment Values

Create production environment values from:

```text
apps/mobile/.env.production.example
```

Required values:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Only publishable/client-safe values belong in the mobile app.

## Firebase Deployment

Create `.firebaserc` from:

```text
.firebaserc.example
```

Install and log in to Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use your-production-firebase-project-id
```

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore
```

Deploy Functions:

```bash
cd apps/functions
npm install
npm run build
cd ../..
firebase deploy --only functions
```

## Functions Environment

Create functions environment values from:

```text
apps/functions/.env.example
```

Required values:

- `STRIPE_SECRET_KEY`
- `STRIPE_CURRENCY`

Use Stripe live mode only when the app is ready for real charges.

## Stripe Production Setup

Before launch:

- Create or verify the laundromat Stripe account.
- Add business identity and banking details.
- Use test mode for QA.
- Switch mobile publishable key to live publishable key for production.
- Switch functions secret key to live secret key for production.
- Add a Stripe webhook before public launch.

Recommended webhook event:

- `payment_intent.succeeded`

The webhook should mark orders paid server-side. The current mobile-side paid
update is acceptable for MVP testing, but webhooks should become the production
source of truth.

## Push Notifications

Push notifications require:

- EAS project id in `app.json`
- EAS credentials configured
- Production build or development build
- User opt-in from the account panel

Remote push notifications should be tested on physical devices.

## App Store / Play Store Prep

Before submission:

- Confirm final app name.
- Confirm bundle id/package id.
- Prepare app icon and splash screen.
- Prepare screenshots.
- Prepare privacy policy URL.
- Prepare terms URL.
- Prepare support email or phone.
- Prepare store description and keywords.
- Complete Apple privacy nutrition labels.
- Complete Google Play Data Safety form.

## Verification Commands

Mobile:

```bash
cd apps/mobile
npm run typecheck
npx expo export --platform web --output-dir dist-check
```

Functions:

```bash
cd apps/functions
npm run typecheck
npm run build
```

