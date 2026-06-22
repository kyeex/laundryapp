# Laundry Delivery App Roadmap

This roadmap is designed for incremental development. Each phase should produce a usable slice of the product before adding the next layer.

## Product Goal

Build a mobile-first laundry delivery platform where customers can request laundry service, the laundromat owner can manage orders, and drivers can handle pickup and delivery batches.

The application will support three roles:

- Customer
- Owner/Admin
- Driver

## MVP Service Menu

Initial customer services:

- Wash and fold
- Dry cleaning
- Wash and fold + dry cleaning

Initial upsells:

- Separate colors: $2.50
- Comforter: $9.00
- Extra detergent preference
- Fabric softener preference
- Hang dry request
- Rush service
- Stain treatment

Upsells should be stored as configurable service add-ons so the business can change names, prices, and availability later.

## Phase 1: Product Foundation

Goal: Define the product clearly before writing app code.

Deliverables:

- MVP feature list
- User roles and permissions
- Customer, owner, and driver user stories
- Order lifecycle
- Initial database schema
- Mobile screen map
- Admin dashboard screen map
- Incremental development checklist

Exit criteria:

- The core workflow is clear from request to payment to delivery.
- The database structure supports customers, orders, add-ons, drivers, batches, and payments.
- Phase 2 can begin without guessing about the product shape.

## Phase 2: App Project Setup

Goal: Create the technical foundation.

Build:

- Expo React Native app
- TypeScript setup
- Expo Router navigation
- Firebase project connection
- Environment configuration
- Shared theme and basic UI components
- Basic role-aware routing structure

Exit criteria:

- App launches locally.
- Firebase config is connected.
- Placeholder screens exist for customer, owner, and driver flows.

## Phase 3: Authentication and User Profiles

Goal: Let people sign in and land in the correct experience.

Build:

- Email/password authentication
- User profile creation
- Role field: customer, owner, driver
- Customer profile fields
- Driver profile fields
- Owner/admin guard
- Sign out flow

Exit criteria:

- Customers, drivers, and owner can log in.
- Users are routed by role.
- Basic profile data is stored in Firestore.

## Phase 4: Customer Order Request MVP

Goal: Let customers submit laundry service requests.

Build:

- Customer home screen
- Address form
- Schedule pickup form
- Service selection
- Add-on/upsell selection
- Notes/special instructions
- Order review screen
- Submit order request
- Customer order history
- Customer order detail/status screen

Exit criteria:

- A customer can submit an order request.
- The order appears in Firestore with selected services and add-ons.
- The customer can track the order status.

## Phase 5: Owner/Admin Order Management MVP

Goal: Let the laundromat manage incoming work.

Build:

- Admin dashboard
- Incoming order list
- Order detail page
- Accept order
- Decline order
- Edit order notes
- Update order status
- Add final price
- View customer contact/address info

Exit criteria:

- Owner can accept or decline incoming requests.
- Owner can update statuses throughout the order lifecycle.
- Owner can enter a final price for payment.

## Phase 6: Driver Batch Management MVP

Goal: Let drivers handle assigned pickup and delivery work.

Build:

- Driver dashboard
- Assigned batch list
- Batch detail view
- Order stops inside a batch
- Mark picked up
- Mark delivered
- Mark failed attempt
- Driver notes

Exit criteria:

- Owner can assign orders to a batch.
- Driver can see assigned work.
- Driver status updates are visible to owner and customer.

## Phase 7: Payments

Goal: Let customers pay for completed or priced orders.

Build:

- Stripe account setup
- Payment intent creation through backend function
- Customer payment screen
- Payment status tracking
- Admin payment visibility
- Receipt reference storage

Exit criteria:

- Owner can set final price.
- Customer can pay through Stripe.
- Order payment status updates after successful payment.

## Phase 8: Notifications

Goal: Keep each role informed without constant manual checking.

Build:

- Push notification setup
- New order notification for owner
- Order accepted/declined notification for customer
- Status update notification for customer
- Batch assignment notification for driver
- Payment request notification for customer

Exit criteria:

- Important order events trigger notifications.
- Notifications deep link to the correct order or batch when possible.

## Phase 9: Admin Operations and Configuration

Goal: Make the business configurable without code changes.

Build:

- Manage services
- Manage add-ons/upsells
- Manage pricing
- Manage pickup windows
- Manage drivers
- Manage service areas
- Basic business settings

Exit criteria:

- Owner can update service options and prices.
- Customer ordering screens use configured data.

## Phase 10: Production Security and Quality

Goal: Harden the app before real customers use it.

Build:

- Firestore security rules
- Role-based access checks
- Form validation
- Error handling
- Loading and empty states
- Audit fields on key records
- Basic automated tests
- Manual QA checklist

Exit criteria:

- Customers cannot access admin/driver data.
- Drivers only see assigned batches.
- Owner has appropriate full operational access.
- Critical flows are tested.

## Phase 11: Deployment and Launch Prep

Goal: Prepare public releases.

Build:

- Expo EAS build configuration
- App icons and splash screen
- Production Firebase project
- Production Stripe keys
- Privacy policy
- Terms of service
- App Store / Google Play metadata
- Admin web hosting
- Backup/export plan

Exit criteria:

- Mobile app can be submitted to app stores.
- Admin dashboard is deployed.
- Production environment is separated from development.

## Phase 12: Post-MVP Growth Features

Goal: Add features once the core business flow is stable.

Potential features:

- Live driver GPS tracking
- Route optimization
- SMS notifications
- Recurring subscriptions
- Promo codes
- Loyalty program
- Tips
- Customer reviews
- Photo proof of pickup/delivery
- QR or barcode bag tracking
- Multiple laundromat locations
- Owner analytics
- Driver earnings reports
- AI support assistant
- AI route and batch suggestions
- AI order note summaries

