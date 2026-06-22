# Phase 10 Security and QA Checklist

Use this checklist before moving from MVP development into real pilot testing.

## Firebase Setup

- Deploy Firestore rules from `firestore.rules`.
- Deploy Firestore indexes from `firestore.indexes.json`.
- Create at least one owner account by setting `users/{userId}.role` to `owner`.
- Confirm customer signup cannot create an owner role.
- Confirm public signup only creates customer users.
- Confirm driver accounts are provisioned by the business with a user document
  and driver profile.

## Role Access

- Customer can only see their own orders.
- Customer cannot open admin routes.
- Customer cannot see another customer's order detail.
- Customer cannot set final price.
- Customer cannot assign drivers or create batches.
- Customer can create and update only their own profile summary, default address,
  and laundry preferences.
- Owner can view all orders.
- Owner can update order status and final price.
- Owner can manage services, add-ons, pickup windows, and settings.
- Owner can manage comforter sizes, dry-cleaning items, gratuity rates, and
  service availability.
- Driver can only see assigned batches.
- Driver cannot see unassigned orders.
- Driver can only update assigned pickup/delivery stops and submit assigned routes.

## Order Flow

- Customer cannot submit an order without a service.
- Customer cannot submit an order without street, city, state, ZIP, date, and pickup window.
- Pickup date uses `YYYY-MM-DD`.
- State uses two-letter abbreviation.
- ZIP code is valid.
- Order starts as `requested` and `unpaid`.
- Order creates an `orderEvents` timeline entry.
- Owner can accept and decline.
- Owner can set final price.
- Customer sees pay button only when final price exists and payment is unpaid.

## Batch Flow

- Owner cannot create batch without driver.
- Owner cannot create batch without at least one order.
- Owner cannot create batch without scheduled date.
- Pickup batch marks orders `pickup_assigned`.
- Delivery batch marks orders `delivery_assigned`.
- Driver can mark pickup as `picked_up` or `failed_pickup`.
- Driver can mark delivery as `delivered` or `failed_delivery`.
- Driver can unselect a checked stop back to `pickup_assigned` or
  `delivery_assigned`.
- Driver can finalize and submit an assigned route.

## Payment Flow

- Stripe publishable key is only in mobile env.
- Stripe secret key is only in functions env.
- Customer cannot create a PaymentIntent for another customer's order.
- Customer cannot pay an order without final price.
- Customer cannot pay an already paid order.
- Order stores Stripe PaymentIntent id.
- Production adds Stripe webhook before real launch.

## Notifications

- Native development build has EAS project id.
- User can enable notifications from account panel.
- Token is stored in `users/{userId}.expoPushTokens`.
- New order event notifies owners.
- Price set event notifies customer.
- Batch assignment event notifies driver.
- Payment completed event notifies owners.
- Tapping notification opens the intended route.

## Production Readiness

- Replace any test Stripe keys before launch.
- Confirm Firebase project is production, not development.
- Confirm Firestore rules are deployed.
- Confirm Functions are deployed.
- Confirm owner and driver accounts cannot be created from public signup.
- Confirm app has privacy policy and terms.
- Confirm support phone/email are configured.
- Run a full order from signup through delivery completion.
- Run at least one failed pickup and failed delivery scenario.
- Export or back up Firestore data before pilot launch.
