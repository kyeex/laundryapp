# Phase 5: Emulator + Staging Testing

## Automated Checks

Run direct route refresh checks:

```powershell
npm run test:routes:refresh
```

Run Firestore emulator rules tests after Java 17+ is installed:

```powershell
npm run test:emulator
```

Run the full Phase 5 suite:

```powershell
npm run test:phase5
```

## Firestore Rules Coverage

The emulator test suite covers:

- Customer can read/write own profile.
- Customer can create own order request.
- Customer cannot edit order status or final price.
- Customer can read own rewards.
- Customer cannot grant themselves reward points.
- Owner can manage orders, batches, catalog/configuration, and rewards.
- Owner cannot access admin-only user records or audit logs.
- Driver can read assigned batch.
- Driver can update assigned stop status.
- Driver cannot read unrelated orders or batches.
- Admin can manage users, rewards, and audit logs.

## Staging Walkthrough

Use staging after rules and functions are deployed:

1. Sign in as admin.
2. Create or seed customer, owner, driver, and admin accounts.
3. Sign in as customer and create an order.
4. Confirm customer can refresh direct routes like `/new-order` and `/my-orders/{orderId}`.
5. Sign in as owner and accept or decline the customer order.
6. Confirm owner can create a pickup batch and assign it to a driver.
7. Sign in as driver and confirm only assigned batches appear.
8. Driver marks stops and submits route.
9. Owner moves the order through pricing/payment/ready-for-delivery.
10. Confirm customer tracking updates.
11. Try blocked access:
    - Customer opens owner/admin routes.
    - Driver opens unrelated batch or order.
    - Owner opens admin-only tools.
    - Customer attempts to change rewards points.

## Current Local Prerequisite

Firebase Firestore emulator requires Java. If `npm run test:emulator` fails with a Java message, install Java 17 or newer, reopen PowerShell, then rerun the command.
