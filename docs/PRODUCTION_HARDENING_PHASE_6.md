# Phase 6: Production Hardening

Last updated: 06/27/2026

## Goal

Make the app safer to operate before any real production launch:

- Backup dry run.
- Monitoring review dry run.
- Admin recovery drill.
- Production environment verification.
- Security review.
- Regression checklist before release.

## Can Features Still Be Added?

Yes. Features and polish can continue while Phase 6 is active.

The rule is:

- Build new features in staging.
- Run focused feature QA.
- Run the Phase 6 hardening gate before calling the app release-ready.
- Do not launch production with known hardening failures.

As the app gets closer to real users, we should eventually create a short release-candidate window where only bug fixes, copy fixes, and launch blockers are added.

## New Hardening Command

Production gate:

```powershell
npm run phase6:production:check
```

Staging gate:

```powershell
npm run phase6:staging:check
```

Both staging and production:

```powershell
npm run phase6:all:check
```

## What The Gate Checks

| Pass | What It Does | Result Needed |
|---|---|---|
| Backup dry run | Prints the Firestore export command and target bucket/path without running the export. | Owner/developer confirms the backup destination is correct. |
| Monitoring review dry run | Prints Firebase Console links and the function-log command without reading production logs by default. | Owner/developer knows where to review errors, usage, auth, and functions. |
| Admin recovery drill | Prints Firebase Auth and Firestore user links, plus the required admin fields. | Owner/developer can recover admin access if locked out. |
| Production environment verification | Confirms production env values are filled and separated from staging/demo. | Production points to `laundryapp-production`, not staging/demo. |
| Security review | Runs Firestore emulator security regression unless skipped. | Wrong-role access remains blocked. |
| Regression checklist | Uses the repo regression checklist and automated checks as the release gate. | No critical workflow regressions. |

## Manual Release Checklist

Before release:

1. Run `npm run phase6:production:check`.
2. Confirm the backup dry-run destination is correct.
3. Confirm monitoring links open for the production Firebase project.
4. Confirm the admin recovery process is understood by the business owner.
5. Confirm Firestore rules regression passes.
6. Confirm staging real-role QA passes.
7. Confirm Android/iOS native build tests pass if launching mobile.
8. Confirm Stripe/payment module is either complete or clearly disabled/demo-only.
9. Confirm privacy policy and terms are ready for real users.
10. Confirm support contact and emergency admin recovery path are documented.

## Current Production-Hardening Notes

- Firestore backup export still requires a real Google Cloud Storage bucket before an actual export can run.
- Monitoring dry run is safe and read-only. Reading logs requires explicit production access approval.
- Admin recovery helper is read-only and does not create/modify users.
- Firestore rules regression is the current strongest automated security check.
- Native push notifications and Stripe real payments still require their own final QA gates.

## Phase 6 Result Criteria

Phase 6 is considered passed when:

- `npm run phase6:production:check` completes successfully.
- A real backup export has been tested at least once before launch.
- Production monitoring links and log review process are confirmed.
- Admin recovery has been walked through without changing production data.
- Security rules tests pass.
- The manual regression checklist is completed for the release candidate.
