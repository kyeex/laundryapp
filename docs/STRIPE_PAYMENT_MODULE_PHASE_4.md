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

## Phase 4.3 PaymentIntent Backend Hardening

Status: completed for staging backend.

The hardened backend now checks:

- User is signed in.
- User has the `customer` role.
- Order exists.
- Order belongs to the customer.
- Order status is payment-eligible.
- Owner has entered a final price.
- Final price is greater than `$0.00`.
- Order is not already paid.
- Reward credit is valid.
- Reward credit does not exceed balance.
- Reward credit does not exceed order total.
- Final payable amount is calculated on the backend.
- Stripe amount is converted to cents on the backend.
- Existing pending PaymentIntents are reused only when amount/reward data still
  match.
- Mismatched cancelable PaymentIntents are canceled before a replacement is
  created.
- Non-cancelable processing payments block a duplicate payment attempt.
- The Stripe PaymentIntent id is saved on the order.
- The order becomes `paymentStatus: pending`.
- A backend-owned `payments/{paymentIntentId}` record is created.
- The app receives only `paymentIntentClientSecret`.

Staging QA command:

```powershell
npm run qa:staging:stripe-paymentintent
```

Latest result:

- Created a staging-only QA order.
- Owner priced the QA order at `$12.34`.
- Backend created a Stripe sandbox PaymentIntent.
- Backend returned only the PaymentIntent client secret.
- Firestore order stored safe `paymentId`, not the full client secret.
- Order moved to `paymentStatus: pending`.

This test does not charge real money. It creates a Stripe sandbox PaymentIntent
only.

## Next Phase

Phase 4.4 should connect this hardened backend path to the native Stripe
PaymentSheet experience and test payment presentation on a real mobile build.

## Phase 4.4 PaymentSheet Frontend

Status: frontend prepared, native device QA blocked by EAS project linking.

What was prepared:

- Customer payment screen opens the backend `createPaymentIntent` flow.
- App receives only the PaymentIntent client secret.
- Native mobile builds use Stripe PaymentSheet through
  `initializeAndPresentPaymentSheet`.
- Payment button is only enabled for payment-eligible order statuses.
- Customer sees a clearer pending message while checkout is preparing, opening,
  and confirming.
- Customer cancellation is treated as a normal canceled checkout instead of a
  scary payment failure.
- Rewards cannot reduce the payable amount to `$0.00` until no-card checkout is
  intentionally added.
- Customer order detail only shows `Pay final balance` when the order is
  actually payable.

Verification completed:

```powershell
npm run check:functions
npm run qa:staging:stripe-paymentintent
cd apps/mobile
npx expo export --platform web --output-dir ..\..\dist-check
```

Results:

- Functions build passed.
- Staging Stripe PaymentIntent QA passed.
- Web export smoke check passed.

Native build blocker:

```powershell
npm run mobile:readiness:staging
```

Current readiness result:

- Android/iOS identifiers pass.
- Staging env values pass.
- Android APK build profile passes.
- EAS project id is not linked yet.
- EAS login could not be confirmed.

Next owner/developer action:

```powershell
cd C:\Users\kdill\OneDrive\Documents\Laundryapp\apps\mobile
npx eas-cli login
npx eas-cli init
```

After EAS is linked:

```powershell
npm run mobile:readiness:staging
npm run mobile:build:android:staging
```

Native PaymentSheet QA must be done on the Android staging APK or iOS preview
build. Web preview cannot prove Stripe PaymentSheet behavior because the Stripe
native UI only runs in native mobile builds.

## Phase 4.5 Webhook Confirmation

Status: webhook code implemented and deployed to staging with a temporary
placeholder webhook secret.

Staging webhook URL:

```text
https://us-central1-laundryapp-staging.cloudfunctions.net/stripeWebhook
```

Important: staging currently has a temporary `STRIPE_WEBHOOK_SECRET`
placeholder. The webhook endpoint is deployed, but real Stripe events will not
verify successfully until the placeholder is replaced with the real Stripe
webhook signing secret that starts with `whsec_`.

### What The Webhook Handles

| Stripe event | App action |
|---|---|
| `payment_intent.succeeded` | Verifies amount/order/customer metadata, marks order paid, writes payment record, audit log, order event, redeems rewards credit, and awards earned rewards once. |
| `payment_intent.payment_failed` | Marks the order unpaid unless already paid, stores failure details, writes payment record, audit log, and order event. |
| `payment_intent.processing` | Keeps the order pending and writes a payment-processing order event. |
| `charge.refunded` | Marks payment/order refunded and writes audit/event records. |
| `refund.created` / `refund.updated` | Updates refund data on the payment/order. |
| `charge.dispute.created` | Stores dispute details, writes audit/event records, and notifies owner payment alerts. |

### Security Rules In The Webhook

The webhook:

- Requires `POST`.
- Requires the `Stripe-Signature` header.
- Verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET`.
- Uses Stripe `rawBody` signature verification.
- Rejects events with missing order/customer metadata.
- Confirms the PaymentIntent amount matches the backend-calculated order balance.
- Confirms the PaymentIntent currency matches the configured backend currency.
- Confirms the Stripe customer metadata matches the Firestore order customer.
- Confirms the PaymentIntent id matches the order payment reference.

### Owner Action Required

Create the real Stripe staging webhook endpoint:

1. Open Stripe Dashboard in sandbox/test mode.
2. Go to Developers -> Webhooks.
3. Add endpoint.
4. Use this endpoint URL:

```text
https://us-central1-laundryapp-staging.cloudfunctions.net/stripeWebhook
```

5. Select these events:

```text
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.processing
charge.refunded
refund.created
refund.updated
charge.dispute.created
```

6. Copy the signing secret that starts with `whsec_`.
7. Do not paste the signing secret into chat or GitHub.
8. Set it in Firebase staging:

```powershell
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project laundryapp-staging
```

9. Redeploy staging functions:

```powershell
npm run deploy:staging:functions
```

### Verification Completed

```powershell
npm run check:functions
npm run deploy:staging:functions
npm run qa:staging:stripe-paymentintent
```

Results:

- Functions build passed.
- `stripeWebhook` was created in Firebase staging.
- Existing PaymentIntent staging QA still passes.

### Verification Still Needed

After the real `whsec_...` webhook secret is set:

- Use Stripe Dashboard to send a test `payment_intent.succeeded` event.
- Complete a real sandbox PaymentSheet test on Android.
- Confirm the webhook marks the order paid if the app is closed after payment.
- Confirm owner notification/audit logs are created for payment events.
- Confirm rewards are redeemed/earned once, not duplicated.
