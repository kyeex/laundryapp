# LaundryStar Prototype Backend Alignment

These prototypes remain standalone HTML/CSS/JS, but their UI now mirrors the LaundryStar Firebase backend contract in `apps/mobile`.

## Shared contract

`shared/laundrystar-contract.js` exposes:

- `collections`: Firestore collection names from `firestore.rules`
- `actions`: service/function names from `apps/mobile/src/services`
- `orderStatuses`: the `OrderStatus` union from `apps/mobile/src/types/domain.ts`
- `orderTimeline`: lifecycle groupings from `apps/mobile/src/workflows/orderWorkflow.ts`
- `orders`, `batches`, `users`: demo records shaped like backend domain objects

## Role app mapping

Customer prototype:

- `createCustomerOrder`
- `users`
- `customerProfiles`
- `addresses`
- `orders`
- `customerPreferences`
- `paymentSetups`

Merchant prototype:

- `getAdminOrders`
- `updateOrderStatus`
- `setOrderFinalPrice`
- `finalizeOrderPayment`
- `createBatch`
- `orders`
- `batches`
- `driverProfiles`
- `auditLogs`

Driver prototype:

- `getDriverBatches`
- `updateDriverOrderStop`
- `updateBatchStatus`
- `orders`
- `batches`
- `orderEvents`
- `driverProfiles`

## Connection path

Replace `window.LaundryStarContract` reads with the existing Firebase services:

- `orderService.ts`
- `batchService.ts`
- `paymentService.ts`
- auth/profile services used by the Expo app

The static forms already include `data-action`, `data-collection`, `data-field`, `data-role`, and `data-to-status` attributes to make the intended backend mapping explicit.
