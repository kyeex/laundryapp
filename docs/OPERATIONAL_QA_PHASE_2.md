# Phase 2: Operational QA Polish

Last updated: 06/27/2026

## Goal

Prove the real staging workflow behaves like a working laundromat operating system:

- Admin prepares staging users/data.
- Customer places a real staging order.
- Owner accepts, prices, finalizes payment, and completes the order.
- Owner creates pickup and delivery batches.
- Driver completes pickup and delivery routes.
- Admin can verify audit logs.
- Wrong-role access stays blocked.

## Staging Order Used

| Field | Value |
|---|---|
| Order ID | `UoacOmaiGnKPIUiUdp6C` |
| Order number | `ORD-UOACOMAI` |
| Customer | Staging Customer |
| Customer phone | `555-1001` |
| Address | `456 Staging QA Avenue Unit 2B, Atlanta, GA 30303` |
| Final status | Completed |
| Payment status | Paid |

## Manual Workflow Result

| Area | Result |
|---|---|
| Admin seed/reset tools | Passed. Staging tools ran against `laundryapp-staging` and preserved seeded users. |
| Customer order creation | Passed. Customer created a wash-and-fold order with add-ons and a full address. |
| Owner new request workflow | Passed. Owner saw the order in new requests, opened manage order, and accepted it with confirmation. |
| Pickup batch stress test | Passed after polish fix. Owner selected two accepted orders and created a pickup batch. |
| Driver pickup route | Passed. Driver saw assigned route, checked off stops, and submitted the route. |
| In-store owner workflow | Passed. Owner marked received, in progress, saved final price, finalized payment, and marked ready for delivery. |
| Delivery batch workflow | Passed. Owner created a delivery batch for the ready order. |
| Driver delivery route | Passed. Driver marked delivery complete and submitted the delivery route. |
| Owner completion workflow | Passed. Owner completed the delivered order with confirmation. |
| Customer order data | Passed. Order number, contact data, schedule, address, add-ons, notes, total, and status stayed consistent. |
| Wrong-role route access | Passed. Customer, owner, and driver were redirected/blocked from routes outside their role. |
| Audit logs | Passed. Admin can read lifecycle audit logs for the QA order. |

## Automated Staging Role Verification

Command run:

```powershell
$env:NODE_OPTIONS='--use-system-ca'; node scripts/staging-role-qa.mjs UoacOmaiGnKPIUiUdp6C
```

Result: passed.

Covered:

- Customer can read their own completed order.
- Customer cannot list batches.
- Driver can read the assigned completed order.
- Driver cannot list all orders.
- Owner can read the business order.
- Owner cannot read audit logs.
- Admin can read audit logs for the QA order.

## Polish Fixes Made

- Added an explicit `Select order` / `Selected` button to eligible batch orders so selection is reliable even when drag behavior is available.
- Improved the batch date picker accessibility label.
- Updated the new-order visual bag label to use the live billable weight instead of a static `20 lb`.

## Build/Check Results

| Check | Result |
|---|---|
| `git diff --check` | Passed. |
| `npm run check:functions` | Passed. |
| `node --check scripts/staging-role-qa.mjs` | Passed. |
| Expo web export from `apps/mobile` | Passed. |
| `npm run mobile:typecheck` | Blocked by Node heap out-of-memory. |
| `npm run check:mobile` | Blocked by Node heap out-of-memory even with 4GB heap. |

The mobile typecheck issue is a tooling/memory issue to address in a later engineering-maintenance pass. The changed screens bundled successfully through Expo web export.

## Remaining Polish Notes

- Consider improving calendar day accessibility roles so automated UI checks can target day buttons more cleanly.
- Driver route list labels can be spaced more clearly in compact cards, for example `Pickup Completed` instead of visually compressed text.
- Add a lower-memory or segmented TypeScript check strategy for this large Expo app.

## Result

Phase 2 Operational QA is substantially passed for staging. The core real-role business workflow completed from customer order request through owner completion, driver routing, and admin audit verification.
