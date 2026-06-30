# Phase 4: Stripe Payment Module

Last updated: 06/29/2026

## Current Focus: Phase 4.2 Firebase Secrets

Goal: store the Stripe server key securely in Firebase so Cloud Functions can
create and verify payments without putting the key in the mobile app or GitHub.

## What Was Prepared In Code

The payment functions now use Firebase Secret Manager:

- `createPaymentIntent`
- `confirmOrderPayment`

Only those functions are bound to `STRIPE_SECRET_KEY`. Other functions do not
receive the Stripe secret unless we explicitly add it later.

## What The Owner Needs To Do

Run this from the project root or from any terminal where Firebase CLI is logged
in:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY --project laundryapp-staging
```

When prompted, paste the Stripe sandbox restricted/secret key. The key should
start with `rk_test_` or `sk_test_`.

Do not paste the secret key into chat. Do not commit it to GitHub.

After the staging secret is set, deploy staging functions:

```powershell
npm run deploy:staging:functions
```

Production gets its own live key later:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY --project laundryapp-production
```

Do not set the production live key until we are ready for real payments.

## Mobile App Key

The mobile app only receives the Stripe publishable key:

```text
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

This is not the same as the server key. The publishable key can initialize
Stripe PaymentSheet, but it cannot create charges by itself.

## Completion Checklist

- Stripe sandbox key exists.
- Staging Firebase secret `STRIPE_SECRET_KEY` is set.
- Staging functions deploy succeeds after the secret is set.
- Mobile staging env has `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`.
- No Stripe secret appears in source code, docs, terminal transcripts committed
  to Git, or GitHub.

## Next Phase

Phase 4.3 hardens the PaymentIntent backend:

- Confirm order belongs to the customer.
- Confirm final price exists and is greater than zero.
- Confirm reward credit is valid.
- Create the Stripe PaymentIntent.
- Save `paymentStatus: pending` and the Stripe PaymentIntent id.
- Return only the client secret to the mobile app.
