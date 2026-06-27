# Launch Checklist

## Accounts

- Expo account created.
- Firebase production project created.
- Stripe account verified.
- Apple Developer account active.
- Google Play Developer account active.
- Business support email/phone ready.

## Branding

- Final business/app name selected.
- Final bundle id/package id selected.
- App icon approved.
- Splash screen approved.
- Store screenshots prepared.

## Firebase

- Production Firebase web app created.
- Firebase Auth email/password enabled.
- Firestore rules deployed.
- Firestore indexes deployed.
- Functions deployed.
- Owner account provisioned.
- Test customer account created.
- Test driver account created.
- Backup/export plan reviewed.
- Production Firestore backup bucket created.
- First production Firestore export completed before real users.
- Restore drill completed into staging or recovery project.
- Monitoring/log review plan reviewed.
- Firebase Console access confirmed for technical admin.
- Production monitoring dry run completed.
- Admin recovery process reviewed.
- At least two active admin users confirmed.
- Emergency admin recovery owner assigned.

## Stripe

- Test payment succeeds.
- Failed payment path tested.
- Live keys stored only in production environments.
- Webhook added before public launch.
- Refund/support process documented.

## Mobile App

- Development build works.
- Preview build works.
- Production build completes.
- Push notification token registers.
- Customer can submit order.
- Owner can accept, price, and batch order.
- Driver can complete pickup/delivery.
- Customer can pay priced order.
- Customer sees updated status.

## Store Submission

- Privacy policy URL available.
- Terms of service URL available.
- Support URL or email available.
- Apple privacy labels completed.
- Google Data Safety completed.
- Test account credentials ready for reviewers.
- Internal testing release completed.
- Production release approved by owner.

## Pilot Launch

- Start with limited service area.
- Monitor orders manually for first week.
- Verify notifications are delivered.
- Verify Stripe payouts.
- Export/backup Firestore data using `docs/BACKUP_EXPORT_PLAN.md`.
- Review logs and stuck orders using `docs/MONITORING_LOG_REVIEW.md`.
- Keep admin recovery process available using `docs/ADMIN_RECOVERY_PROCESS.md`.
- Collect customer and driver feedback.
