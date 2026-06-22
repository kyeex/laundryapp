# LaundryApp Mobile

Expo React Native mobile app for the laundry delivery platform.

## Phase 2 Scope

This app currently includes:

- Expo TypeScript setup
- Expo Router navigation
- Placeholder route groups for auth, customer, owner/admin, and driver
- Shared theme primitives
- Initial domain types
- Firebase configuration placeholder
- Static MVP service and add-on catalog

## Phase 3 Scope

Authentication now includes:

- Firebase email/password sign in
- Firebase account creation for customers
- Password reset email request
- Auth state provider
- Role-based route guards
- Role-based redirects after sign in/signup
- Basic account panel with sign out

New customer accounts create records in:

- `users/{userId}`
- `customerProfiles/{userId}`

Owner and driver accounts should not be publicly self-selected. Create their
Firebase Auth accounts intentionally, then create or update the matching
`users/{userId}` document with `role: "owner"` or `role: "driver"` and
`active: true`. Driver users should also have a `driverProfiles/{userId}`
document.

## Phase 4 Scope

Customer ordering now includes:

- Service selection
- Add-on/upsell selection
- Customer address entry
- Pickup date and time-window entry
- Customer notes
- Add-on estimate before submit
- Firestore order creation
- Customer order history
- Customer order detail/status view

Submitting an order creates records in:

- `addresses/{addressId}`
- `orders/{orderId}`
- `orderEvents/{eventId}`

The order starts with `status: "requested"` and `paymentStatus: "unpaid"`.
Final pricing remains an owner/admin action in a later phase.

## Phase 5 Scope

Owner/admin order management now includes:

- All-order admin list
- Incoming request count
- Admin order detail screen
- Accept order
- Decline order
- Update operational status
- View customer contact, customer address, pickup, service, add-ons, and notes
- Enter final price

Setting a final price updates the order to `status: "priced"` and keeps
`paymentStatus: "unpaid"` until the payment phase. Every owner status or price
change writes an `orderEvents` timeline record.

## Phase 6 Scope

Driver batch management now includes:

- Owner pickup/delivery batch creation
- Active driver selection
- Eligible order selection for pickup or delivery
- Batch assignment to a driver
- Recent batch list for the owner
- Driver assigned batch list
- Driver batch detail with stops
- Driver status updates for picked up, delivered, failed pickup, and failed delivery

Creating a batch writes a `batches/{batchId}` record and updates each assigned
order with the relevant pickup/delivery batch and driver fields. Driver stop
updates write `orderEvents` records and update the order status.

## Phase 7 Scope

Payments now include:

- Stripe React Native SDK setup
- StripeProvider at the app root
- Customer payment screen for priced, unpaid orders
- Firebase callable function client for `createPaymentIntent`
- PaymentSheet initialization and presentation
- Order payment status update after successful payment

The mobile app expects the backend callable function to return:

- `paymentIntentClientSecret`
- Optional `customerId`
- Optional `customerEphemeralKeySecret`

The first backend implementation lives in `apps/functions/src/index.ts`.
Production payment confirmation should eventually rely on Stripe webhooks as the
source of truth, with the current mobile-side paid update treated as an MVP
bridge.

## Phase 8 Scope

Notifications now include:

- Expo Notifications SDK setup
- Native push token registration
- Android default notification channel
- Firestore storage of `expoPushTokens` on `users/{userId}`
- Notification response deep-link handling
- Account-panel opt-in button

Push notifications require an EAS project id. Remote push notifications are not
available in Expo Go on Android for this SDK line, so test with a development or
release build.

## Phase 9 Scope

Admin configuration now includes:

- Business name, phone, and service area notes
- Service name, description, base price, active status, and sort order
- Add-on name, description, price, active status, owner-confirmation flag, and sort order
- Pickup window label, active status, and sort order
- Comforter size pricing
- Dry-cleaning item pricing
- Gratuity rate options
- Pickup calendar availability

Configuration is stored in:

- `settings/business`
- `services/{serviceId}`
- `addOns/{addOnId}`
- `comforterSizeAddOns/{addOnId}`
- `dryCleaningItems/{itemId}`
- `pickupWindows/{pickupWindowId}`

Customer profile and preference data is stored in:

- `customerProfiles/{userId}`
- `addresses/{userId}-default`
- `customerPreferences/{userId}`

The customer order form now reads active services, add-ons, and pickup windows
from Firestore. If configuration collections are empty, the app falls back to the
Phase 1 defaults.

## Phase 10 Scope

Security and quality hardening now includes:

- Firestore rules in `../../firestore.rules`
- Firestore index config in `../../firestore.indexes.json`
- Client-side validation helpers
- Validation applied to order, batch, profile, pricing, and configuration writes
- Release QA checklist in `../../docs/PHASE_10_SECURITY_QA.md`

## Phase 11 Scope

Deployment and launch prep now includes:

- EAS build/submit config in `eas.json`
- Production mobile env example in `.env.production.example`
- Firebase project example in `../../.firebaserc.example`
- Deployment guide in `../../docs/PHASE_11_DEPLOYMENT.md`
- Launch checklist in `../../docs/LAUNCH_CHECKLIST.md`
- Privacy policy draft in `../../docs/PRIVACY_POLICY_DRAFT.md`
- Terms draft in `../../docs/TERMS_OF_SERVICE_DRAFT.md`
- Store metadata draft in `../../docs/STORE_METADATA_DRAFT.md`

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in the Firebase values when the Firebase project is created.
3. Add `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Configure an EAS project id before testing push notifications.
5. Run the app:

```bash
npm start
```

Phase 11 has started deployment and launch prep. Post-MVP growth features start
in the next phase.

## Verification

```bash
npm run typecheck
npx expo export --platform web --output-dir dist-check
```

The export command was used to verify the Expo Router bundle path. On this
Windows/OneDrive workspace, `expo start` and `npm run web` currently hit a local
React Native DevTools `spawn EPERM` permission issue before binding to a port.
