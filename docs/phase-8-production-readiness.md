# Phase 8: Production Readiness

Goal: prepare Firebase for real users while keeping demo, staging, and production separated.

## Current Environment Model

```mermaid
flowchart LR
  Demo["Demo mode<br/>Local sample data"] --> App["Mobile/Web app"]
  Staging["Firebase staging<br/>Real test users/data"] --> App
  Production["Firebase production<br/>Real business users/data"] --> App

  App --> Firestore["Firestore"]
  App --> Auth["Firebase Auth"]
  App --> Functions["Cloud Functions"]
```

- Demo is for local walkthroughs and sample data.
- Staging is for real Firebase testing before launch.
- Production is for real customers, staff, and business data only.

## Readiness Commands

Run staging checks:

```powershell
npm run phase8:staging:check
```

Run production checks:

```powershell
npm run phase8:production:check
```

Deploy staging rules:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\phase8-production-readiness.ps1 -Environment staging -DeployRules
```

Deploy staging functions:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\phase8-production-readiness.ps1 -Environment staging -DeployFunctions
```

Deploy production rules only after staging passes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\phase8-production-readiness.ps1 -Environment production -DeployRules -AllowProductionDeploy
```

Deploy production functions only after staging passes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\phase8-production-readiness.ps1 -Environment production -DeployFunctions -AllowProductionDeploy
```

## Pass Checklist

| Pass | Status | Notes |
| --- | --- | --- |
| Deploy rules to staging | Complete | `firestore.rules` compiled and deployed to `laundryapp-staging`. |
| Deploy functions to staging | Blocked by Blaze | Firebase stopped while enabling required Cloud Functions APIs because staging is not on Blaze. |
| Test staging accounts | Manual test required | Admin, owner, driver, customer. |
| Deploy rules to production | Hold until staging passes | Requires explicit production flag in helper script. |
| Deploy functions to production | Hold until staging functions pass | Also requires Blaze. |
| Remove unsafe demo fallback from production | In place | Demo backend is used only when `EXPO_PUBLIC_APP_ENV=demo`. |
| Confirm production env variables | Complete | `npm run env:production:check` passed. |
| Add backup/export plan | Documented below | Needs Firebase/GCP console setup. |
| Add monitoring/log review checklist | Documented below | Review Firebase console after launch. |
| Document emergency admin recovery | Documented below | Manual console process. |

## Current Firebase Project Confirmation

The Firebase CLI can see these required projects:

- `laundryapp-staging`
- `laundryapp-production`

The `.firebaserc` file also has a `demo` alias pointing at `laundryapp-demo`, but that exact project was not visible in the CLI project list. That is okay for local demo mode, because the app uses local demo data when `EXPO_PUBLIC_APP_ENV=demo`. Create a real `laundryapp-demo` project later only if you want Firebase-hosted demo data separate from staging.

## Staging Account Test Plan

1. Sign in as admin.
2. Create owner, driver, customer, and admin users.
3. Confirm each user appears in Admin > Users.
4. Sign in as customer and place an order.
5. Sign in as owner and accept/decline the order.
6. Move an accepted order through received, in progress, price saved, payment finalized, ready for delivery, complete.
7. Create pickup and delivery batches.
8. Sign in as driver and confirm only assigned routes are visible.
9. Confirm customer cannot access owner/admin pages.
10. Confirm owner cannot access admin-only tools.
11. Confirm audit logs appear for user, order, price, batch, driver, and rewards actions.

## Production Safety Rules

- Never seed demo data into production.
- Never run staging tests against production users.
- Never deploy production functions before staging functions have passed.
- Never use Stripe live keys in demo or staging.
- Never use Stripe test keys in production when real payments launch.
- Keep `.env.staging` and `.env.production` out of Git.

## Backup And Export Plan

Minimum plan before real users:

1. Enable Firestore scheduled backups in the Firebase/GCP console if available for the project.
2. Create a dedicated Google Cloud Storage bucket for Firestore exports.
3. Use a naming pattern like:

```text
gs://laundryapp-production-firestore-backups/YYYY-MM-DD/
```

4. Export before any major deployment.
5. Keep at least 30 days of daily backups once the business is live.
6. Test one restore into a separate recovery/staging project before launch.

Manual export command shape, if the Google Cloud CLI is installed and configured:

```powershell
gcloud firestore export gs://laundryapp-production-firestore-backups/manual-YYYY-MM-DD --project laundryapp-production
```

## Monitoring And Log Review Checklist

Daily during staging:

- Firebase Authentication sign-in errors.
- Firestore permission-denied errors.
- Cloud Functions errors and timeouts.
- Audit log volume and missing action types.
- Unexpected user role changes.
- Failed order creation or batch creation.
- Rewards adjustment/redemption errors.

Weekly after production launch:

- Review admin and owner actions in Audit Logs.
- Review inactive or suspicious users.
- Review Firestore usage and billing.
- Review Cloud Functions invocations and errors.
- Review backup completion status.

## Emergency Admin Recovery

Use this if the admin gets locked out.

1. Open Firebase Console for the correct project.
2. Go to Authentication and confirm the admin email exists.
3. Copy that user's UID.
4. Go to Firestore.
5. Open or create `users/{uid}`.
6. Set:

```json
{
  "role": "admin",
  "active": true
}
```

7. Confirm the document also includes the admin email/display name fields used by the app.
8. Sign out and sign back into the app.
9. Add an audit log note manually or through the app once access is restored.

## Blaze Reminder

Blaze is mainly needed for deploying Cloud Functions to Firebase staging and production. Without Blaze, we can still build the function code locally and deploy Firestore rules, but Firebase may block live function deployment.
