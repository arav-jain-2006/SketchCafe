# Test cases and results

Executed on 17 November 2026. After the menu and SQL seed updates, the full automated suite passed **62 tests**, with zero failures, skips or cancellations. The combined PDF now uses the current cafe menu for its browser examples and the updated 62-test summary. The regression row records a rerun rather than another unique automated test.

## Run the tests

Open PowerShell in the project folder:

```powershell
npm.cmd test
```

For a smaller group:

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:security
node --test test/unit/cart.test.js
```

Each automated case loads the current cafe menu from src/seed.sql into an isolated test database. The standard module order uses two Lattes at INR 70 each, totaling INR 140. Security cases start a temporary server on an available local port. Tests do not change the application's saved demo database.

## Module tests

| Module | Cases | Result |
| --- | ---: | --- |
| Authentication and staff accounts | 6 | Pass |
| Menu catalog | 5 | Pass |
| Cart management | 6 | Pass |
| Orders and pickup | 5 | Pass |
| Payments | 4 | Pass |
| Demo payment gateway | 4 | Pass |
| In-app notifications | 4 | Pass |
| Reviews and support | 6 | Pass |
| Sales reports | 4 | Pass |
| Input validation | 4 | Pass |
| Database | 4 | Pass |
| Application setup and menu update | 6 | Pass |
| Total module tests | 58 | Pass |

## Additional simple checks

| PDF ID | Type and scenario | Method and observed result | Status |
| --- | --- | --- | --- |
| TC45 | Integration: payment to staff queue | test/integration/workflow.test.js: unpaid order hidden; successful verification produced one Paid queue entry. | Pass |
| TC46 | Integration: Ready status to inbox | Same file: Preparing followed by Ready recorded the pickup message and Ready state. | Pass |
| TC47 | Security: guest opens staff queue | test/security/access.test.js: unauthenticated request rejected with 401. | Pass |
| TC48 | Security: staff opens admin features | Same file: staff queue allowed; administrator staff-list request rejected with 403. | Pass |
| TC49 | System: complete pickup order | Browser: Asha, 9876543210, one Masala Dosa plus one Tea. Demo payment produced INR 78 receipt. Staff marked Preparing, Ready and Completed. Customer saw Completed and messages; active queue emptied. | Pass |
| TC50 | UI: blank login | Browser: clicked Sign in with empty fields. Required-field prompt appeared and sign-in screen remained. | Pass |
| TC51 | UI: mobile menu and cart | Browser at 390 x 844: added a current-menu Latte at INR 70 and opened View cart. Controls fitted; document width 375 <= viewport 390, without horizontal overflow or stray values. | Pass |
| TC52 | Regression after menu and SQL seed updates | Full suite: 62 passed, zero failed. This includes 58 module tests, two integration tests and two access-control tests. | Pass |

## Repeat the browser checks

1. Start the app with `node src/server.js`. Use fictional customer details and simulated payment; no money moves.
2. TC49: add one Masala Dosa (INR 63) and one Tea (INR 15). Enter Asha and 9876543210, place the order, start demo UPI and simulate success. Check the INR 78 receipt. In a second tab, sign in as staff and mark Preparing, Ready and Completed. Check the customer status and that this order leaves the active queue.
3. TC50: sign out, leave both login fields blank and click Sign in. Required-field validation must block submission.
4. TC51: use a 390 x 844 viewport. Open the menu, add an item and select View cart. Check that fields/buttons fit, with no horizontal scrolling or stray 0/null values.

The browser execution used an isolated seeded demo database, not the application's saved data. The UI correction prevents a SQLite numeric flag from rendering a zero in an available cart line.

## Combined PDF and scope

[Combined test-case PDF](documents/Sketch%20Cafe%20-%20Module%20Test%20Cases.pdf) contains TC01-TC44 for the original nine main modules and TC45-TC52 for the checks above.

Its 52 rows comprise 48 automated feature checks, three browser checks and one regression rerun. Fourteen supporting module cases remain in their source files and summary, giving 62 unique automated tests in total. Automated cases use an isolated copy of the current SQL cafe menu, including Latte at INR 70. The PDF omits the execution date; dates in report-test inputs are fixed test data. Browser cases are recorded observations rather than an installed browser automation suite. No load, recovery or comprehensive security assessment is claimed.

See test-results.txt and menu-update-results.txt for executed results and browser observations.

## Menu update verification

The new seeded menu has 44 food items from the cafe photo and eight approved drinks in six categories. Serving-time restrictions are omitted. Two added module cases confirm that old order prices survive the replacement and that repeated starts preserve admin edits without duplicating items. An old cart must remove archived items before checkout.

The browser check confirmed Drinks filtering and all eight drink prices, dosa search, removal of an archived cart item, and checkout of one Masala Dosa plus one Tea. Both the order summary and successful demo receipt showed INR 78. Staff then advanced this order to Completed; the customer saw the completed status and notification history, and the active queue became empty. The current-menu Latte also passed the 390 x 844 mobile check at INR 70. The existing local database was updated and its order, order-line and payment records compared unchanged before and after. The automated fixture now uses the same cafe menu, with two Lattes producing INR 140 and three producing INR 210.

Menu initialization now uses `src/seed.sql` to insert SQLite records; there is no JavaScript menu-data file. The existing application tests exercise a fresh SQL seed, preservation of saved orders and repeated seeding after admin edits. The full 62-test suite was rerun after this refactor.
