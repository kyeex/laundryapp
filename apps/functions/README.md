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

Copy `.env.example` to `.env` and set:

```bash
STRIPE_SECRET_KEY=
STRIPE_CURRENCY=usd
```

Never put the Stripe secret key in the mobile app.

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
