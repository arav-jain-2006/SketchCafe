# Test cases and results

Executed on 17 November 2026. The full automated suite passed **60 tests**, with zero failures, skips or cancellations. Three additional browser checks passed. The regression row records a rerun rather than another unique automated test.

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

Each automated case uses an isolated test database. Security cases start a temporary server on an available local port. Tests do not change the application's saved demo database.

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
| Application setup | 4 | Pass |
| Total module tests | 56 | Pass |

## Additional simple checks

| PDF ID | Type and scenario | Method and observed result | Status |
| --- | --- | --- | --- |
| TC45 | Integration: payment to staff queue | test/integration/workflow.test.js: unpaid order hidden; successful verification produced one Paid queue entry. | Pass |
| TC46 | Integration: Ready status to inbox | Same file: Preparing followed by Ready recorded the pickup message and Ready state. | Pass |
| TC47 | Security: guest opens staff queue | test/security/access.test.js: unauthenticated request rejected with 401. | Pass |
| TC48 | Security: staff opens admin features | Same file: staff queue allowed; administrator staff-list request rejected with 403. | Pass |
| TC49 | System: complete pickup order | Browser: Asha, 9876543210, one Iced Spanish Latte. Demo payment produced INR 185 receipt. Staff marked Preparing, Ready and Completed. Customer saw Completed and messages; active queue emptied. | Pass |
| TC50 | UI: blank login | Browser: clicked Sign in with empty fields. Required-field prompt appeared and sign-in screen remained. | Pass |
| TC51 | UI: mobile menu and cart | Browser at 390 x 844: added a latte and opened View cart. Controls fitted; document width 375 <= viewport 390, without horizontal overflow. Stray cart zero corrected and rechecked. | Pass |
| TC52 | Regression after cart display fix | Reran original module suite: 56 passed. Reran full suite: 60 passed, zero failed. | Pass |

## Repeat the browser checks

1. Start the app with `node src/server.js`. Use fictional customer details and simulated payment; no money moves.
2. TC49: add one Iced Spanish Latte, enter Asha and 9876543210, place the order, start demo UPI and simulate success. In a second tab, sign in as staff and mark Preparing, Ready and Completed. Check the customer status and the empty active queue.
3. TC50: sign out, leave both login fields blank and click Sign in. Required-field validation must block submission.
4. TC51: use a 390 x 844 viewport. Open the menu, add an item and select View cart. Check that fields/buttons fit, with no horizontal scrolling or stray 0/null values.

The browser execution used an isolated seeded demo database, not the application's saved data. The UI correction prevents a SQLite numeric flag from rendering a zero in an available cart line.

## Combined PDF and scope

[Combined test-case PDF](documents/Sketch%20Cafe%20-%20Module%20Test%20Cases.pdf) contains TC01-TC44 for the original nine main modules and TC45-TC52 for the checks above.

Its 52 rows comprise 48 automated feature checks, three browser checks and one regression rerun. Twelve supporting module cases remain in their source files and summary, giving 60 unique automated tests in total. Browser cases are recorded observations rather than an installed browser automation suite. No load, recovery or comprehensive security assessment is claimed.

See test-results.txt for the executed automated output and browser observations.
