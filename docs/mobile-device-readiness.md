# Mobile Device Readiness

Phase 4 proves the staging app works well on real phones before production release.

## Current Gate Status

| Gate | Status | Notes |
| --- | --- | --- |
| Staging environment values | Passed | `apps/mobile/.env.staging` is filled and points to `laundryapp-staging`. |
| Android APK profile | Passed | EAS `preview` profile builds Android as an APK for internal install. |
| EAS login | Blocked | Local EAS CLI reports `Not logged in`. |
| EAS project link | Blocked | `apps/mobile/app.json` still has `REPLACE_WITH_EAS_PROJECT_ID`. |
| Local web export | Passed | Expo web export completed. |
| TypeScript mobile check | Needs follow-up | Current full mobile typecheck exhausts Node heap. |
| Android emulator/device tooling | Needs setup | `adb` is not available on PATH. |

## Android Staging Build

Goal: create an installable APK for real Android phone testing.

1. Log in to EAS from `apps/mobile`.
2. Link or initialize the EAS project so `extra.eas.projectId` is real.
3. Run `npm run mobile:readiness:staging`.
4. Run `npm run mobile:build:android:staging`.
5. Install the APK on a test Android phone.
6. Confirm the app shows the staging environment banner.

## Android Customer QA

Use `staging.customer@laundryapp.test`.

1. Sign in.
2. Confirm customer dashboard loads without cramped text or clipped buttons.
3. Create a new order.
4. Confirm service cards, weight stepper, address fields, schedule selectors, add-ons, gratuity, and final review are usable with thumbs.
5. Confirm order review/payment screen loads.
6. Confirm order tracking timeline is readable.
7. Confirm rewards page works when rewards are enabled and is hidden/paused when disabled.

## Android Owner QA

Use `staging.owner@laundryapp.test`.

1. Sign in.
2. Confirm owner dashboard attention cards fit on screen.
3. Open orders grid/list and confirm filters are usable on phone.
4. Open manage order and confirm customer details, timeline, status buttons, final price, and payment confirmation are usable.
5. Create pickup and delivery batches.
6. Open rewards management and confirm tier controls and toggle are usable.
7. Open reports and business configuration and check for horizontal overflow.

## Android Driver QA

Use `staging.driver@laundryapp.test`.

1. Sign in.
2. Confirm assigned route appears.
3. Open route.
4. Mark pickup/delivery stops.
5. Confirm check marks and undo behavior.
6. Finalize and submit route.
7. Confirm completed routes hide or disable completed-only actions.

## Responsive Fix Criteria

Fix a screen before release if any of these happen on a real phone:

- Horizontal scrolling appears.
- A primary button is hidden, clipped, or too small to tap.
- Text overlaps or is cut off.
- A table/grid is unreadable without a mobile card alternative.
- Date pickers or dropdowns fall off screen.
- Confirmation dialogs appear outside the visible area.

## iOS TestFlight Plan

Start after Android staging passes.

1. Confirm Apple Developer account access.
2. Add iOS production bundle identifier in Apple Developer portal if needed.
3. Configure EAS iOS credentials.
4. Add Apple merchant ID later when Stripe/Apple Pay is implemented.
5. Run an iOS preview build.
6. Upload to TestFlight.
7. Test customer, owner, and driver flows on at least one real iPhone.
