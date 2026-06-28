# Phase 5: Notifications

Last updated: 06/28/2026

## Goal

Make customers, owners, and drivers aware of important order and route changes.

## Status

| Pass | Status | Notes |
|---|---|---|
| Customer order status notifications | Verified in staging data flow | `status_changed`, `price_set`, and driver route status events route to the customer through `customerOrderUpdates`. |
| Owner new request notifications | Verified in staging data flow | `order_created` routes to active owner users through `ownerNewRequests`. |
| Owner payment notifications | Verified in staging data flow | `payment_completed` routes to active owner users through `ownerPaymentUpdates`. |
| Driver assigned route notifications | Verified in staging data flow | `batch_assigned` routes to the assigned driver through `driverAssignedRoutes`. |
| Notification preferences | Verified in staging rules | Users can update their own notification preferences and cannot change their role/status through that write. |
| Native push testing | Not complete yet | Requires linked EAS project id, staging Android/iOS build, physical device permission, and saved Expo push token. |

## Verification Commands

```powershell
npm run test:emulator
npm run deploy:staging:firestore
npm run qa:staging:notifications
npm run check:functions
npm run deploy:staging:functions
```

## Latest Staging Result

`npm run qa:staging:notifications` passed these checks:

- Customer can save notification preferences.
- Customer cannot change role while saving notification preferences.
- Customer, owner, and driver profiles have the needed preference keys.
- Admin can read active owner notification recipients.
- Owner can read recent order notification events.
- Order-created events route to active owners.
- Status/price/driver-status events route to the customer.
- Payment-completed events route to active owners.
- Batch-assigned events route to the staging driver.

The command may show a Firebase `PERMISSION_DENIED` log line because the QA intentionally tries a blocked customer role-change write. The checklist marks that as `PASS`.

## Native Push Test Still Needed

After mobile build setup is complete:

1. Add the real EAS project id to `apps/mobile/app.json`.
2. Build the Android staging APK.
3. Install on a real Android phone.
4. Sign in as customer, owner, and driver in separate test sessions.
5. Tap `Enable` in the notification area for each role.
6. Confirm each user doc receives an Expo push token.
7. Trigger order status, new request, and batch assignment events.
8. Confirm the real phone receives the expected push notifications.

## Current Boundary

Order data remains owner-managed. Admin can manage users and audit-style tools, but the notification QA uses the owner role to verify order events and order records.
