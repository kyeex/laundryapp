# Production Foundation Phase 1

This phase turns the local demo into a real Firebase-backed application while
keeping the demo fallback available for development.

## What Changed

- Public account creation is customer-only.
- Owner and driver accounts must be provisioned by the business.
- Firestore rules now cover the newer production collections:
  - `customerPreferences/{userId}`
  - `comforterSizeAddOns/{addOnId}`
  - `dryCleaningItems/{itemId}`
- Customers can update their own profile contact fields, default address, and
  laundry preferences.
- Drivers can update only their assigned stops and submit assigned routes.
- Owners keep operational control over orders, batches, catalog, settings, and
  business configuration.

## Firebase Setup Steps

1. Create a Firebase project.
2. Enable Email/Password sign-in in Firebase Authentication.
3. Create a web app in Firebase and copy its config values.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
5. Fill in:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`
6. Copy `.firebaserc.example` to `.firebaserc` and replace the project id.
7. Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore
```

## Provision The First Owner

The public app must not let someone choose the owner role. To create the first
owner:

1. Create the owner in Firebase Authentication.
2. Copy the Firebase Auth user id.
3. Create `users/{ownerUserId}` in Firestore:

```json
{
  "email": "owner@example.com",
  "role": "owner",
  "displayName": "Business Owner",
  "phone": "555-0000",
  "active": true,
  "expoPushTokens": []
}
```

After that owner signs in, they can manage orders, batches, and configuration.

## Provision Drivers

Driver accounts should also be created intentionally by the business:

1. Create the driver in Firebase Authentication.
2. Copy the Firebase Auth user id.
3. Create `users/{driverUserId}`:

```json
{
  "email": "driver@example.com",
  "role": "driver",
  "displayName": "Driver Name",
  "phone": "555-0000",
  "active": true,
  "expoPushTokens": []
}
```

4. Create `driverProfiles/{driverUserId}`:

```json
{
  "userId": "driverUserId",
  "active": true,
  "phone": "555-0000",
  "vehicleInfo": ""
}
```

## Database Collections

The production app uses these Firestore collections:

- `users`
- `customerProfiles`
- `driverProfiles`
- `addresses`
- `orders`
- `orderEvents`
- `batches`
- `services`
- `addOns`
- `comforterSizeAddOns`
- `dryCleaningItems`
- `pickupWindows`
- `settings`
- `customerPreferences`
- `payments`

## Verification

Run these after changes:

```bash
cd apps/mobile
npm run typecheck
npx expo export --platform web --output-dir dist-check
```

Then verify:

- Customer can create an account.
- Customer cannot access owner or driver screens.
- Owner can sign in only if provisioned in Firestore.
- Driver can sign in only if provisioned in Firestore.
- Customer profile summary saves.
- Customer preferences save and populate new order notes.
- Owner configuration saves and appears on New Order.
- Driver can submit only assigned routes.
