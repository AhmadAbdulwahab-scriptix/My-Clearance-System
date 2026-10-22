# Clearance system frontend

Plain HTML, CSS and JavaScript. No build step, no libraries.
The look follows PalmPay: a violet brand colour, white cards on a light lavender page, rounded corners and pill buttons.

## Setup

1. Put this `public` folder in the backend project root, next to `server.js`.
2. In `src/app.js`, add the two lines marked NEW **before** `app.use('/api', routes)`:

```js
const path = require('path');                                    // NEW
app.use(express.static(path.join(__dirname, '..', 'public')));   // NEW
app.use('/api', routes);
```

3. Make sure `.env` has `PORT=5000` (the server falls back to 5080 without it).
4. The backend must have these endpoints: `GET /api/admin/items`, `GET /api/admin/requests` and `GET /api/admin/students/:id` (the admin Students "View" button and Clearance items tab), and the public `GET /api/certificates/verify/:code` (the verify page).
5. Run `npm run seed` once, then `npm run dev`, and open http://localhost:5000

Serving the pages from Express makes them same-origin, so there are no CORS problems. If you open them with Live Server instead, the code calls `http://localhost:5000/api` automatically.

## Seeded logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@clearance.local | Admin@12345 |
| Personnel | library@clearance.local, bursary@clearance.local, hostel@clearance.local, head.of.department@clearance.local, sports.office@clearance.local, faculty.dean@clearance.local, director.of.health@clearance.local | Personnel@12345 |
| Student | register on the sign-in page | your choice |

## Changing the look

All colours and sizes are variables at the top of `css/style.css`. To change the brand colour, edit `--primary` (and `--primary-dark`, `--primary-soft`). Nothing else needs touching.
I could not read PalmPay's official colour codes, so `#6b2bd9` is an approximation of their violet. Swap in the exact value if you have it.

## Files

| File | What it does |
|---|---|
| `css/style.css` | All styling, in numbered sections with comments |
| `js/api.js` | Talking to the backend: `api()`, login token, current user, logout |
| `js/ui.js` | Shared helpers (escape text, dates, tables, popup form, message box, spinners) and the page shell (header, tabs, notifications) |
| `js/index.js` | Sign in and registration |
| `js/student.js` | Student page: request, certificate (print only) and the assistant chat |
| `verify.html`, `js/verify.js` | Public page that checks a certificate code (opened by the QR code) |
| `js/config.js` | Settings you may change: `SITE_URL`, the address used inside the QR code |
| `js/vendor/qrcode.js` | QR code generator (qrcode-generator 2.0.4 by Kazuhiko Arase, MIT licence). The only third-party code in the project |
| `img/` | Put `buk-logo.png` here (see the certificate section) |
| `js/personnel.js` | Office staff page |
| `js/admin.js` | Admin page |
| `index.html`, `student.html`, `personnel.html`, `admin.html` | Page structure only; each loads `api.js`, `ui.js`, then its own script |

## How the code works (for your defence)

**One door to the backend.** Every call goes through `api(path, options)` in `api.js`. It adds the token to the request header, waits for the JSON reply, and returns the `data` part. If the server answers with an error, it throws an `Error` with the server's message. The pages never call `fetch` themselves.

**The page shell.** Each page starts with `startPage(role, tabs)`. It checks the user is signed in with the right role, builds the header and tab buttons, and calls the first tab's `load` function. Clicking a tab hides the other sections and calls that tab's `load` function.

**The same pattern in every tab.**
1. `load` function: call `api(...)` with `await` and get the data.
2. Build an HTML string from the data (rows in an array, then `buildTable`).
3. Put the string in the page with `innerHTML`.
4. Attach click handlers to the new buttons with `onClickAll`.
5. A click handler is wrapped in `tryAction`, which shows any error as a red message.

**Why `escapeHtml`.** Names and reasons come from users. Putting them into HTML unescaped would let someone inject a script, so every piece of text goes through `escapeHtml` first.

**Why `Promise.all`.** On the student page and the analytics tab, several backend calls do not depend on each other. `Promise.all` sends them together and waits for all, so the page draws once instead of piece by piece.

**Language features used.** Functions, `async`/`await`, `try`/`catch`, arrays with `forEach`, template strings, `addEventListener`, `localStorage`, `FormData`, the `<dialog>` element. No classes, no modules, no frameworks.

## What each screen calls

| Screen | Endpoints |
|---|---|
| Sign in / register | `POST /auth/login`, `POST /auth/register` |
| Student, My clearance | `POST /clearance/requests`, `GET /clearance/requests/my`, `GET /clearance/requests/:id`, `/estimate`, `/certificate`, `PATCH /clearance/items/:id/resubmit` |
| Student, Assistant | `POST /chatbot/query` |
| Personnel, Queue | `GET /clearance/items/pending`, `PATCH /clearance/items/:id/approve`, `/reject` |
| Personnel, History | `GET /clearance/personnel/history`, `PATCH /clearance/items/:id/unreject` |
| Personnel, Statistics | `GET /clearance/personnel/statistics` |
| Header bell (all roles) | `GET /notifications/my`, `PATCH /notifications/:id/read`, `/mark-all-read` |
| Admin, Overview | `GET /admin/dashboard` |
| Admin, Students | `GET /admin/students` with every filter, `GET /admin/students/:id` (View button) |
| Admin, Clearance items | `GET /admin/items`, `PATCH /admin/clearance/items/:id/reassign`, `/override-approve` |
| Admin, Personnel | `GET/POST /admin/personnel`, `PATCH /admin/personnel/:id/status` |
| Admin, Analytics | `GET /admin/analytics/rejections`, `/bottlenecks` |
| Admin, Search | `GET /admin/search` |

## The certificate

On the student page, once every office has approved, a card says the certificate is ready. The certificate itself is **not shown on the page**. It only appears when the student clicks **Print certificate** (it is hidden on screen and shown by the print styles in `css/style.css`). In the print window, "Save as PDF" keeps a copy.

Top to bottom: logo (centred), **Bayero University Kano**, department, title, a one-line statement, student details (name, registration number in capitals, department), the QR code with the certificate code under it, a "Cleared by" table (office and status, in stage order), and a footer with the issue time and the print time. The print time is set to the exact moment of printing. It is sized to fit one A4 page, even with ten offices.

- **Logo.** Save the university logo as `img/buk-logo.png`. Until the file is there, a round "BUK" badge shows instead.
- **QR code.** It holds a link to the public verify page, for example `https://your-site/verify.html?code=CLR-...`. Scanning it opens the page, which asks the backend whether that code exists. The address in the link comes from `SITE_URL` in `js/config.js`. Leave it empty and the link uses the address the student is on, which on the deployed site is the real domain. While you test on your own computer that address is `localhost`, which a phone cannot open. To test with a phone, open the site on both devices through your computer's network address (for example `http://192.168.1.20:5000`), or fill in `SITE_URL`.
- **Printed code.** It stays under the QR code. It can be typed into the verify page if the QR cannot be scanned.

## The verify page

`verify.html` is public: nobody has to sign in. It reads `?code=` from the address, calls `GET /api/certificates/verify/:code`, and shows one of three results: **Valid certificate** (name, registration number in capitals, department, code, issue date and time), **Certificate not found**, or **Could not check right now** (server unreachable, or too many attempts). A code can also be typed into the box on that page. The backend needs the public verify endpoint for this page to work.

## Things to know

- **Registration numbers are always shown in capitals** (`formatReg` in `js/ui.js`), and new registrations are saved in capitals.
- **The assistant chat survives a refresh.** It is saved in the browser per student (`localStorage`, key `chat-<user id>`). A question is saved before it is sent, so if the page is refreshed while the assistant is still typing, the question is sent again on reload and the answer appears. Signing out clears the chat, because `logout()` clears everything saved in the browser. "Clear chat" empties it by hand.
- **Times.** The student's request tab shows date and time for submission and approval.

- **Refresh keeps your place.** The open tab is stored in the address (for example `admin.html#items`), so a refresh reopens the same tab.
- **Messages pop up next to the button you pressed**, fade out by themselves, and are green for success and red for errors. (`showToast` and `placeToast` in `ui.js`.)
- **Spinners.** A button shows a spinner and is disabled while its request runs, so double clicks cannot send the same action twice. A tab shows a large spinner the first time it loads, and lists dim while they reload. (`setLoading`, `refreshing`, `onClick`, `onSubmit` in `ui.js`.)
- **Approve, reject and reopen update the list straight away**, then reload the real list in the background.
- **Red buttons** (`btn-danger`) are used for Cancel, Reset, Close, Reject and Deactivate.
- `startPage(...)` must stay at the bottom of each page script, because the first tab starts loading immediately and needs everything above it to exist.

- The token and user are kept in `localStorage`. If any call returns 401 (expired token), the user is signed out.
- The "Year in reg. no." filter is a regex on the registration number, so type `/22/`, not `2022`.
- "Waiting" counts days since `unlockedAt`. Seven days or more shows in red.
- Resubmission documents are links only. The backend has no file upload endpoint.

## Troubleshooting

- "Cannot reach the server": the backend is not running, or not on port 5000.
- A page keeps returning to the sign-in page: the token expired, or the account's role does not match that page.
- `npm run dev` does not decide online or offline. The database is whatever `MONGO_URI` points to: `mongodb://127.0.0.1...` needs local MongoDB running, `mongodb+srv://...` needs internet.
