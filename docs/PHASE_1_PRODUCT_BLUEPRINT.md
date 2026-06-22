# Phase 1 Product Blueprint

## Purpose

This document defines the first version of the laundry delivery app before implementation begins. It is intentionally simple and additive: each feature should make the product more useful without making the first build harder than it needs to be.

## Product Summary

The app helps customers request laundry pickup and delivery, helps the laundromat owner manage orders, and helps drivers complete assigned pickup and delivery batches.

The first production-ready version should support:

- Customer order requests
- Owner order approval and management
- Driver batch assignment
- Order status tracking
- Final price entry
- Customer payment

## User Roles

### Customer

Customers can:

- Create an account
- Manage basic profile details
- Add pickup/delivery address
- Select laundry services
- Select add-ons
- Schedule pickup
- Submit order request
- Track order status
- Pay when the final price is ready

Customers cannot:

- See other customers
- Edit price
- Assign drivers
- Change admin-only statuses

### Owner/Admin

Owner/admin can:

- View all orders
- Accept or decline requests
- Edit order details
- Add final pricing
- Update order status
- Create pickup/delivery batches
- Assign batches to drivers
- Manage service options later
- Manage add-ons later

Owner/admin should be the only role with full business visibility.

### Driver

Drivers can:

- View assigned batches
- View assigned order stops
- See customer address and delivery notes for assigned orders
- Mark pickup complete
- Mark delivery complete
- Mark failed attempt
- Add driver notes

Drivers cannot:

- See unassigned orders
- Accept or decline customer requests
- Change pricing
- Manage services or add-ons

## MVP Services

Initial services:

- Wash and fold
- Dry cleaning
- Wash and fold + dry cleaning

The app should treat services as configurable records, not hard-coded text, so the business can add or remove services later.

## MVP Add-Ons and Upsells

Initial add-ons:

| Add-on | Starting Price | Notes |
| --- | ---: | --- |
| Separate colors | $2.50 | Customer wants colors separated from whites/lights. |
| Comforter | $9.00 | Extra charge for bulky bedding. |
| Stain treatment | TBD | Price can be decided by owner. |
| Rush service | TBD | Optional faster turnaround. |
| Hypoallergenic detergent | TBD | Can be free or paid depending on business preference. |
| Fabric softener | TBD | Can be free or paid depending on business preference. |
| Hang dry | TBD | May require owner confirmation. |

Add-ons should support:

- Name
- Description
- Price
- Active/inactive status
- Whether owner confirmation is required

## Core Order Lifecycle

Recommended status flow:

1. `requested`
2. `accepted`
3. `declined`
4. `pickup_assigned`
5. `picked_up`
6. `received_at_store`
7. `in_progress`
8. `priced`
9. `payment_requested`
10. `paid`
11. `ready_for_delivery`
12. `delivery_assigned`
13. `out_for_delivery`
14. `delivered`
15. `completed`

Support statuses:

- `cancelled`
- `failed_pickup`
- `failed_delivery`

Simple MVP flow:

1. Customer submits request.
2. Owner accepts or declines.
3. Owner assigns pickup to driver batch.
4. Driver marks picked up.
5. Owner marks received/in progress.
6. Owner enters final price.
7. Customer pays.
8. Owner assigns delivery to driver batch.
9. Driver marks delivered.
10. Order becomes completed.

## Payment Timing

Recommended MVP payment model:

1. Customer submits request without paying upfront.
2. Owner accepts the request.
3. Laundry is picked up and assessed.
4. Owner enters final price.
5. Customer receives payment request.
6. Customer pays before delivery or before completion.

This avoids inaccurate upfront pricing and gives the owner flexibility when weight, items, or add-ons change.

## User Stories

### Customer Stories

- As a customer, I want to create an account so I can request laundry service.
- As a customer, I want to enter my address so the laundromat knows where to pick up and deliver.
- As a customer, I want to choose wash and fold, dry cleaning, or both so my order matches what I need.
- As a customer, I want to add extras like separate colors or comforter cleaning so I can personalize my service.
- As a customer, I want to schedule a pickup time so I know when to have my laundry ready.
- As a customer, I want to track my order so I know what is happening.
- As a customer, I want to pay through the app so checkout is easy.

### Owner/Admin Stories

- As the owner, I want to see incoming order requests so I can approve or decline them.
- As the owner, I want to view order details so I can understand customer needs.
- As the owner, I want to update order status so customers stay informed.
- As the owner, I want to add the final price so customers can pay after the laundry is assessed.
- As the owner, I want to group orders into driver batches so pickups and deliveries are organized.
- As the owner, I want to assign batches to drivers so the work is clear.
- As the owner, I want to manage add-ons later so pricing can change with the business.

### Driver Stories

- As a driver, I want to see assigned batches so I know what work I have.
- As a driver, I want to see pickup and delivery addresses so I can complete my route.
- As a driver, I want to mark an order picked up so the owner and customer know the status.
- As a driver, I want to mark an order delivered so the order can be completed.
- As a driver, I want to report a failed pickup or delivery so the owner can follow up.

## Initial Data Model

### `users`

Stores login-linked identity and role.

Fields:

- `id`
- `email`
- `role`: `customer`, `owner`, or `driver`
- `displayName`
- `phone`
- `createdAt`
- `updatedAt`
- `active`

### `customerProfiles`

Fields:

- `userId`
- `defaultAddressId`
- `notes`
- `createdAt`
- `updatedAt`

### `driverProfiles`

Fields:

- `userId`
- `active`
- `phone`
- `vehicleInfo`
- `createdAt`
- `updatedAt`

### `addresses`

Fields:

- `id`
- `userId`
- `label`
- `street1`
- `street2`
- `city`
- `state`
- `postalCode`
- `deliveryInstructions`
- `createdAt`
- `updatedAt`

### `services`

Fields:

- `id`
- `name`
- `description`
- `basePrice`
- `active`
- `sortOrder`
- `createdAt`
- `updatedAt`

### `addOns`

Fields:

- `id`
- `name`
- `description`
- `price`
- `active`
- `requiresOwnerConfirmation`
- `sortOrder`
- `createdAt`
- `updatedAt`

### `orders`

Fields:

- `id`
- `customerId`
- `customerName`
- `customerPhone`
- `addressId`
- `addressSnapshot`
- `selectedServiceIds`
- `selectedAddOns`
- `scheduledPickupDate`
- `scheduledPickupWindow`
- `status`
- `customerNotes`
- `ownerNotes`
- `driverNotes`
- `estimatedSubtotal`
- `finalPrice`
- `paymentStatus`
- `paymentId`
- `pickupBatchId`
- `deliveryBatchId`
- `assignedPickupDriverId`
- `assignedDeliveryDriverId`
- `createdAt`
- `updatedAt`

### `batches`

Fields:

- `id`
- `type`: `pickup` or `delivery`
- `status`: `draft`, `assigned`, `in_progress`, `completed`, `cancelled`
- `driverId`
- `orderIds`
- `scheduledDate`
- `notes`
- `createdAt`
- `updatedAt`

### `payments`

Fields:

- `id`
- `orderId`
- `customerId`
- `amount`
- `currency`
- `status`
- `stripePaymentIntentId`
- `createdAt`
- `updatedAt`

### `orderEvents`

Fields:

- `id`
- `orderId`
- `type`
- `fromStatus`
- `toStatus`
- `message`
- `createdBy`
- `createdAt`

This collection creates a timeline for the order detail page.

## Mobile App Screen Map

### Shared Screens

- Welcome
- Sign in
- Create account
- Forgot password
- Role-based home redirect
- Account/settings

### Customer Screens

- Customer home
- New order
- Select service
- Select add-ons
- Schedule pickup
- Address form
- Review order
- Order submitted confirmation
- My orders
- Order detail/status timeline
- Payment screen
- Profile

### Owner/Admin Mobile Screens

The owner can use mobile screens for quick updates, but the full dashboard should be web-first.

- Admin home
- Incoming orders
- Order detail
- Update status
- Create batch
- Assign driver
- Batch detail

### Driver Screens

- Driver home
- Assigned batches
- Batch detail
- Stop detail
- Pickup complete
- Delivery complete
- Failed attempt

## Admin Dashboard Screen Map

- Admin login
- Dashboard overview
- Incoming requests
- Orders list
- Order detail
- Batch management
- Create/edit batch
- Driver management
- Customer lookup
- Service management
- Add-on management
- Settings

## Permissions Summary

| Action | Customer | Owner/Admin | Driver |
| --- | --- | --- | --- |
| Create order | Yes | Yes, on behalf of customer later | No |
| View own order | Yes | Yes | Only if assigned |
| View all orders | No | Yes | No |
| Accept/decline order | No | Yes | No |
| Update operational status | Limited/cancel only later | Yes | Assigned pickup/delivery statuses only |
| Set final price | No | Yes | No |
| Pay order | Yes | No | No |
| Create batch | No | Yes | No |
| View assigned batch | No | Yes | Yes |
| Manage services/add-ons | No | Yes | No |

## Phase 2 Starting Checklist

When Phase 2 begins, start with:

1. Create Expo app with TypeScript.
2. Add Expo Router.
3. Add Firebase SDK.
4. Add base folders for app screens, components, services, and types.
5. Create placeholder routes for customer, admin, and driver.
6. Add initial TypeScript types from this blueprint.
7. Add a simple theme and reusable UI primitives.

