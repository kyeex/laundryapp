# Firebase Owner Setup

This is the business-owner checklist for connecting the laundry app to real
Firebase projects.

## Your Part

1. Create two Firebase projects:
   - One staging project for testing.
   - One production project for real business data.

2. In both Firebase projects, enable Authentication:
   - Open Firebase Console.
   - Go to Authentication.
   - Enable Email/Password sign-in.

3. In both Firebase projects, create a Web App:
   - Copy the Firebase web app config values.
   - Put staging values into your staging environment.
   - Put production values into your production environment.

4. Create the first admin account manually:
   - Create the admin user in Firebase Authentication.
   - Copy that user's UID.
   - Create a Firestore document at `users/{uid}`.
   - Use this shape:

```json
{
  "email": "admin@example.com",
  "role": "admin",
  "displayName": "System Admin",
  "phone": "",
  "active": true,
  "expoPushTokens": []
}
```

5. Share these values with the developer/build environment:
   - Staging Firebase project id.
   - Production Firebase project id.
   - Staging Firebase web app config.
   - Production Firebase web app config.
   - Stripe test publishable key.
   - Stripe test secret key.

6. Do not use production for testing sample/demo orders.
   - Use demo mode for local presentations.
   - Use staging for real Firebase testing.
   - Use production only for real users and real business data.

## Developer Deployment Commands

Copy `.firebaserc.example` to `.firebaserc`, then replace the project ids.

Deploy staging:

```bash
firebase use staging
firebase deploy --only firestore
firebase deploy --only functions
```

Deploy production:

```bash
firebase use production
firebase deploy --only firestore
firebase deploy --only functions
```

## What To Test In Staging

- Admin can sign in.
- Admin can create owner, driver, customer, and admin users.
- Password reset emails send.
- Customer can create an order.
- Owner can accept, price, and finalize an order.
- Driver can only see assigned batches.
- Customer cannot open owner, driver, or admin pages.
- Owner cannot open the admin-only demo control center.
- Audit logs appear after owner/admin actions.
- Payment creates a Stripe PaymentIntent and only the backend marks the order paid.
