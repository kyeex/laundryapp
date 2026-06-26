# Phase 6: Cloud Functions

## What Can Be Done Without Blaze

- Write and build Cloud Functions locally.
- Keep sensitive business logic out of the client app.
- Wire the app to call callable functions.
- Validate TypeScript builds.
- Prepare staging deployment scripts.

## What Requires Blaze

Firebase Cloud Functions deployment requires a Blaze-enabled Firebase project. Staging deploy should happen only after the Firebase project is upgraded.

Deploy staging functions after Blaze is enabled:

```powershell
npm run deploy:staging:functions
```

## Implemented Function Boundaries

- Admin creates users through `createManagedUserAccount`.
- Admin updates roles/status through `updateManagedUserAccess`.
- Rewards redemption goes through `redeemRewardsForOrder`.
- Rewards earning goes through `awardOrderRewardsForPaidOrder`.
- Owner/admin reward adjustments go through `adjustCustomerRewards`.
- Payment intent creation and confirmation are already function-backed for the future Stripe phase.
- Audit logs are written server-side for function-owned actions.

## Next Staging Test

1. Enable Blaze on `laundryapp-staging`.
2. Deploy functions.
3. Sign in as admin and create users.
4. Sign in as customer and test reward redemption during checkout.
5. Sign in as owner/admin and test rewards adjustment.
6. Confirm audit logs are created by function actions.
