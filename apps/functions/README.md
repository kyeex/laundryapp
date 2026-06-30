# LaundryApp Functions

Firebase Cloud Functions backend for secure server-side operations.

## Phase 7 Scope

This package currently includes `createPaymentIntent`, a callable function used
by the mobile app to create a Stripe PaymentIntent for a priced customer order.

The function:

- Requires Firebase Auth
- Verifies the order exists
- Verifies the signed-in user owns the order
- Requires `finalPrice` to be set
- Rejects already paid orders
- Creates a Stripe PaymentIntent
- Stores the Stripe PaymentIntent id on the order
- Sets `paymentStatus` to `pending`

## Environment

For deployed staging/production functions, set the Stripe key as a Firebase
secret:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY --project laundryapp-staging
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project laundryapp-staging
firebase functions:secrets:set STRIPE_SECRET_KEY --project laundryapp-production
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project laundryapp-production
```

Then deploy the functions that use it:

```powershell
npm run deploy:staging:functions
```

For local-only function development, a local `.env` can still provide:

```text
STRIPE_SECRET_KEY=sk_test_or_rk_test_value
STRIPE_WEBHOOK_SECRET=whsec_test_value
STRIPE_CURRENCY=usd
```

Never put the Stripe secret key in the mobile app.
Never commit Stripe secret keys to GitHub.

## Verification

Install dependencies before running:

```bash
npm install
npm run typecheck
```

Production should add a Stripe webhook to mark orders paid after Stripe confirms
payment completion.

## Phase 8 Notifications

This package also includes `sendOrderEventNotification`, a Firestore trigger on
`orderEvents/{eventId}`.

It sends Expo push notifications for:

- New order requests to owner accounts
- Batch assignments to assigned drivers
- Price set events to customers
- Status changes to customers
- Payment completed events to owner accounts

The trigger reads `expoPushTokens` from `users/{userId}`. Users add tokens from
the mobile app account panel.
