# Phase 1: Staging Closure

Last updated: 06/27/2026

## Goal

Confirm the Firebase staging foundation is ready for deeper QA:

- Staging, demo, and production environments are separated.
- Current Firestore rules and Cloud Functions are deployed to staging.
- Role-based Firestore rules block wrong-role access.
- Admin-only staging/demo tools cannot run against production projects.
- Audit logs are wired for key owner, driver, admin, rewards, and staging actions.

## Environment Status

| Environment | Firebase project | Status |
|---|---|---|
| Demo | `laundryapp-demo` | Local/demo mode only. Firebase values are intentionally blank in the demo example file. |
| Staging | `laundryapp-staging` | Configured, separated, and filled. |
| Production | `laundryapp-production` | Configured, separated, and filled. Do not use for QA data. |

Commands verified:

```powershell
npm run env:demo:check
npm run env:staging:check
npm run env:production:check
```

Result: all passed.

## Staging Deploy Status

Command run:

```powershell
npm run deploy:staging
```

Result:

- Firestore rules compiled successfully.
- Firestore indexes deployed.
- Firestore rules released to `laundryapp-staging`.
- Cloud Functions build passed.
- Firebase detected no function code changes, so existing staging functions were left current.

Non-blocking warning:

- Firebase CLI reports that the `firebase-functions` package is outdated. This should be handled in a later dependency-maintenance pass, not during closure QA.

## Automated Security Regression

Command run:

```powershell
npm run test:regression
```

Result: passed.

Covered:

- Customer can read/update own profile.
- Customer can create own order request.
- Customer cannot access another customer's private data.
- Customer cannot edit final price/status directly.
- Customer can read own rewards but cannot grant points.
- Owner can manage business orders, batches, catalog/configuration, and rewards.
- Owner cannot access admin-only user tools or audit logs.
- Driver can read assigned batches and update assigned stops.
- Driver cannot see unrelated customer orders or batches.
- Driver cannot change prices, ownership, or unrelated routes.
- Admin can manage users, rewards, and audit logs.
- Unauthenticated users can only read public catalog configuration.

Note: permission-denied log lines during the emulator run are expected because the test intentionally attempts blocked actions.

## Role Route Protection

The app-level route groups are protected by role:

| Route group | Allowed role |
|---|---|
| `/(customer)` | Customer |
| `/(admin)` | Owner |
| `/(driver)` | Driver |
| `/(system-admin)` | Admin |

Wrong-role users are redirected back to their own home route.

## Demo/Staging Tool Safety

Staging data tools are callable only when:

- The user is signed in.
- The signed-in user has admin role.
- The Firebase project id contains `staging`.
- The Firebase project id does not contain `prod` or `production`.

This protects production from staging reset/seed tools.

Admin staging tools include:

- Seed staging users.
- Seed staging sample orders.
- Reset seeded staging demo data.
- View staging seed status.

## Audit Log Coverage

Audit logging is wired for:

- Owner order status changes.
- Owner final price saves.
- Owner payment finalization.
- Owner batch creation.
- Driver stop updates.
- Driver route submission.
- Admin user creation.
- Admin user access/role updates.
- Rewards earned, adjusted, and redeemed.
- Staging seed/reset actions.
- Business configuration saves.
- Rewards program enable/disable.

## Manual Real-Role QA Checklist

Use staging, not production.

### Admin

- Sign in as admin.
- Open Admin panel.
- Create or activate one owner, customer, and driver.
- Confirm users appear under signed-up users.
- Open Audit Logs.
- Confirm user-management actions created audit entries.
- Open Demo Control Center.
- Confirm staging seed tools are visible in staging mode.

### Customer

- Sign in as customer.
- Create a new order.
- Confirm order appears under customer order history.
- Confirm tracking page opens.
- Try opening an owner/admin route directly.
- Expected: customer is redirected or blocked.

### Owner

- Sign in as owner.
- Confirm the customer order appears as a new request.
- Accept the order.
- Move the order through received/in progress.
- Save final price.
- Finalize payment.
- Create pickup/delivery batches where eligible.
- Confirm owner actions appear in Audit Logs.
- Try opening admin-only routes directly.
- Expected: owner is redirected or blocked.

### Driver

- Sign in as driver.
- Open assigned batches/routes.
- Confirm only assigned routes are visible.
- Mark stops.
- Finalize and submit route.
- Confirm driver route actions appear in Audit Logs.
- Try opening unrelated owner/customer/admin pages.
- Expected: driver is redirected or blocked.

## Closure Result

Phase 1 is ready for live staging account QA.

Remaining before production:

- Complete the manual real-role staging checklist above.
- Do real mobile-device testing.
- Finish Stripe/payment module later.
- Upgrade `firebase-functions` in a dependency-maintenance pass.
- Run production safety gate before any real launch.
