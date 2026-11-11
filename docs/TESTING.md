# Test cases and execution results

## Reproduce the checks

From the project folder in PowerShell:

```powershell
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:load
```

The first command runs both the module and integration suites. The next two run them separately. Each suite uses its own fixtures. The HTTP, browser and load suites require localhost access. The persistence tests use unique temporary database files. No suite uses the café's normal database.

Browser checks require Playwright and Chromium. The app and the other tests use built-in Node.js modules.

```powershell
npm.cmd install --no-save --package-lock=false playwright
npx.cmd playwright install chromium
npm.cmd run test:browser
```

To use an existing Playwright installation or browser, set `SKETCH_PLAYWRIGHT_PATH` to the absolute path of Playwright's `index.mjs` and/or `SKETCH_CHROMIUM_PATH` to the executable path. [Playwright browser installation](https://playwright.dev/docs/browsers#install-browsers)

## Results

Executed on 10 November 2026 on Windows using Node.js 24.22.0 and Chromium. **89 of 89 automated cases passed** across 55 module, 14 integration and 20 browser cases. Both load scenarios passed.

The Node coverage run measured **99.77% line coverage** and **97.75% branch coverage** across the in-process backend modules. The browser scripts and the launcher running in a subprocess are verified by their own suites and excluded from those percentages.

```powershell
node --experimental-test-coverage --test "test/unit/*.test.js" "test/integration/*.test.js"
```

### Module cases

Each JavaScript application module has a dedicated test file, named after the module. Cases focus on its normal behavior, relevant boundaries and failure handling. Backend modules that use SQLite run against isolated in-memory databases, with an injected clock or gateway where it helps isolate a rule.

| File in `test/unit` | Cases | Expected behavior verified | Result |
| --- | ---: | --- | --- |
| `app.test.js` | 4 | Shared dependencies agree, injected clock is used, and re-seeding preserves changes | Pass |
| `auth.test.js` | 5 | Password salts differ, roles are isolated, idle sessions expire, and account changes revoke sessions | Pass |
| `cart.test.js` | 5 | Quantities and current prices stay accurate, carts are isolated, and stale availability blocks checkout | Pass |
| `catalog.test.js` | 5 | Filters and availability work, duplicate categories and invalid items are rejected, and archival preserves history | Pass |
| `database.test.js` | 4 | Transactions commit or roll back, foreign keys hold, fixtures are isolated, and a receipt survives reopening | Pass |
| `demo-gateway.test.js` | 4 | References are distinct, unknown references fail, and terminal results preserve the original amount and order | Pass |
| `feedback.test.js` | 4 | Reviews require completion, linked support checks ownership, and resolution retains the first reply | Pass |
| `notifications.test.js` | 4 | Receipt text and pickup instructions are correct, notifications are ordered and isolated, and duplicate stages are rejected | Pass |
| `orders.test.js` | 5 | Checkout validates input and snapshots prices, replays preserve ownership, and staff see only valid paid stages | Pass |
| `payments.test.js` | 6 | Failed attempts can be retried, verified success is idempotent, wrong amounts and ownership mismatches fail, and partial writes roll back | Pass |
| `reports.test.js` | 4 | IST dates, verified sales, zero-result periods and renamed-item totals are correct | Pass |
| `rules.test.js` | 5 | Text, numeric and phone boundaries are enforced and exact paise format correctly | Pass |

### Integration cases

| File in `test/integration` | Cases | Expected behavior verified | Result |
| --- | ---: | --- | --- |
| `http.test.js` | 6 | Correct assets and error responses, origin and role checks, malformed input rejection, password changes, and login throttling | Pass |
| `server.test.js` | 4 | Production entry point binds locally, creates its configured database, seeds the menu and preserves cart data across restarts | Pass |
| `workflow.test.js` | 4 | Duplicate checkout and verification converge, guest/staff/admin handoffs work, and catalog and account changes take effect | Pass |

### Browser and acceptance cases

| File in `browser-tests` | Cases | Expected behavior verified | Result |
| --- | ---: | --- | --- |
| `components.test.js` | 5 | Untrusted text stays plain text, child replacement omits absent values, money is exact, and shared forms and buttons handle loading and errors | Pass |
| `team.test.js` | 5 | Role navigation, guest-to-staff pickup, availability, category/staff creation, sales and support resolution | Pass |
| `ui.test.js` | 4 | Route selection, browser Back, unknown-route fallback and keyboard skip link | Pass |
| `views.test.js` | 6 | Responsive menu and cart, tracking without stray placeholders, failed payment retry, receipt refresh recovery, and support lookup | Pass |

The full demo was also checked in separate guest, staff and admin sessions. The desktop storefront, mobile storefront and desktop staff queue were inspected visually. Keyboard navigation, dialog dismissal, accessible labels and mobile overflow have targeted checks. This is a Chromium verification and a focused accessibility check.

### Performance and deployment scope

| Scenario | Load | Observed p95 | Observed maximum | Result |
| --- | --- | ---: | ---: | --- |
| Menu and cart reads | 50 concurrent clients, 100 requests | 289 ms | 294 ms | Pass. Under the three-second target |
| Cart writes and checkout | 50 concurrent clients, 100 requests | 250 ms | 250 ms | Pass. 50 distinct orders with correct quantities and totals |

Timings are per client's two-request journey on localhost with in-memory fixtures. Pending orders stayed out of the staff queue under load. Browser tests also verify automatic staff queue refresh and customer updates. Live UPI, SMS delivery, deployed HTTPS, sustained production load and opening-hours availability require a deployment environment and live provider integration.
