# Sketch Café

A local, pickup-only ordering system for a software engineering course demonstration. Guests order without creating an account. Staff work a verified-paid queue. The café admin manages the menu, team accounts, reports and customer feedback.

## Run on Windows

Install Node.js 24 or later. The project uses Node's built-in SQLite module, with zero packages to install. [Node.js 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

Open PowerShell in the extracted `SketchCafe` folder and run:

```powershell
node src/server.js
```

Open [Sketch Café on localhost](http://127.0.0.1:3000). The database is created at `data/sketch.sqlite` on first launch. Stop the server with Ctrl+C. To use a fresh database for a demo, set `$env:SKETCH_DB = 'data/demo-2.sqlite'` in the same PowerShell session before starting.

| Role | Username | Initial password |
| --- | --- | --- |
| Staff | `staff` | `SketchStaff!26` |
| Admin | `admin` | `SketchAdmin!26` |

Use separate browser profiles, such as a regular window and an incognito window, for simultaneous staff and admin sign-ins. The guest flow works even if an employee is signed in. Use a fictional name and a demo number such as `9876543210`.

## Demonstrate the product

1. **Guest.** Search for *latte*, open its details, add two and confirm the ₹370.00 cart total. Show the sold-out croissant. Place the pickup order and save the order code.
2. **Payment.** Start demo UPI and simulate failure. Show Pending Payment and the empty staff queue. Retry and simulate success. Show the receipt and the order appearing in the staff queue within its five-second polling interval.
3. **Staff.** Mark the order Preparing, Ready and Completed. Show the guest's status history and Ready message. Mark an item sold out and reload the guest menu to show the update.
4. **Guest and admin.** Submit a review after pickup and send a support request. As admin, check sales and best sellers, view the review, and resolve the support request with a reply. Show the reply on the guest's support lookup.
5. **Design and tests.** Explain the payment boundary, order state diagram, and role enforcement. Run the test suite.

```powershell
npm.cmd test
npm.cmd run test:load
```

The load check measures menu/cart reads and cart/checkout writes with 50 concurrent clients on localhost. For separate unit, integration and Chromium runs, see the [test commands and results](docs/TESTING.md).

## Source map

- `src/server.js` starts the app. `src/app.js` wires feature services to a shared SQLite database. `src/http.js` maps HTTP requests and access rules to those services.
- `src/catalog.js`, `cart.js`, `orders.js`, `payments.js`, `auth.js` and related services each own a feature. `src/schema.sql` enforces database relationships and uniqueness.
- `public/ui.js` handles navigation and view lifecycles. `views.js` renders guest screens, `team.js` renders staff and admin workspaces, and `components.js` contains shared controls and API requests.
- `test/unit`, `test/integration` and `browser-tests` contain dedicated test files. Start with the test named after the module you are changing.

## Design and assessment

- [Requirements traceability and design](docs/DESIGN.md) maps the supplied SRS, MoSCoW priorities, DFD processes, module dependencies and order state transitions.
- [Test cases and execution results](docs/TESTING.md) records what was checked and how to reproduce it.
- [Project management](docs/PROJECT_PLAN.md) includes feasibility, estimates, PERT and the critical path.

## Demo boundaries

The UPI gateway is simulated and moves no money. The notification inbox and support lookup are built in. Live UPI verification and SMS delivery require a provider integration. The server is bound to the local machine and serves HTTP for the demo. HTTPS, production account provisioning, operational monitoring, and measured opening-hours availability are deployment work. There is one café and all report dates use IST.

For a local backup, stop the app cleanly and copy the database file. If taking a copy while the database is open, use a SQLite-aware backup. The data file contains demo names and phone numbers, so keep it out of submissions and version control.

## Submission documents and diagrams

- [Software Requirements Specification](docs/requirements/SRS%20Document.pdf)
- [Feasibility study](docs/documents/Sketch%20Cafe%20Feasibility%20Study.docx)
- [MoSCoW prioritization](docs/documents/Sketch%20Cafe%20MoSCoW%20Prioritization.docx)
- [Module test cases and results](docs/documents/Sketch%20Cafe%20-%20Module%20Test%20Cases.pdf)
- [State transition diagram](docs/diagrams/State%20Transition%20Diagram.png)
- [Original UML and data flow diagrams](docs/diagrams)
