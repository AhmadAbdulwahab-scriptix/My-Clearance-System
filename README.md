# AI-Assisted Student Clearance System

> A single-department university clearance workflow backend built with **Express.js** and **MongoDB**, featuring AI-powered automation via **Google Gemini**.

Final-year project: digitizes the manual student clearance process with a staged approval pipeline, real-time notifications (in-app + email), and four AI components — rejection auto-categorization, a RAG chatbot, SLA-based delay reminders, and admin analytics.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Seeded Accounts](#seeded-accounts)
- [Running the Server](#running-the-server)
- [Approval Workflow](#approval-workflow)
- [AI Components](#ai-components)
- [Notifications](#notifications)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [API Overview](#api-overview)
- [License](#license)

---

## Features

| Area | Details |
|------|---------|
| **Authentication** | JWT-based auth with bcrypt password hashing. Three roles: `student`, `personnel`, `admin`. |
| **Staged Clearance Workflow** | Three-stage sequential approval — HOD → other offices (parallel) → Bursary. Items are `locked` until it's the personnel's turn. |
| **AI Rejection Categorization** | Gemini classifies free-text rejection reasons into `Missing Document`, `Unpaid Fee`, `Disciplinary`, or `Other`. Falls back to keyword matching. |
| **AI RAG Chatbot** | Students ask questions about their clearance status. Retrieves their data + anonymized similar cases, then generates an answer via Gemini (or a rule-based summary). |
| **SLA Delay Reminders** | Cron job detects overdue items (configurable SLA, default 7 days) and privately nudges the responsible personnel once per day via notification + email. |
| **Notifications** | Dual-channel: in-app (MongoDB documents) + email (SMTP via nodemailer) with styled HTML templates. Email failures never block workflow. |
| **Admin Dashboard** | System-wide analytics: rejection breakdowns, bottleneck officers, per-student drill-downs, global search, item reassignment, and override approvals. |
| **Resubmission Flow** | Students can resubmit rejected items with notes/documents. Personnel can unreject items. Full audit trail tracked via `resubmissionHistory`. |
| **Clearance Certificates** | Automatically generated with a unique code (`CLR-<timestamp>-<hex>`) when all items are approved. |

---

## Architecture

```
Client (any HTTP client / frontend)
  │
  ▼
Express.js (REST API)
  ├── Middleware: CORS, JSON parsing, JWT auth, role authorization
  ├── Controllers: business logic per route
  ├── Services: AI components, workflow engine, notifications
  ├── Models: Mongoose schemas (MongoDB)
  └── Jobs: node-cron scheduled tasks
  │
  ▼
External Services
  ├── MongoDB Atlas (data persistence)
  ├── Google Gemini API (AI features — optional)
  └── SMTP server (email notifications — optional)
```

---

## Folder Structure

```
clearance-system/
├── server.js                    # Entry point — connects DB, starts server + cron jobs
├── package.json
├── .env                         # Environment config (not committed)
├── .env.example                 # Template for .env
├── .gitignore
├── logs/                        # Auto-created: error.log + combined.log
└── src/
    ├── app.js                   # Express app, middleware, route mounting
    ├── config/
    │   └── db.js                # MongoDB connection (Mongoose)
    ├── models/
    │   ├── User.js              # student | personnel | admin (role field)
    │   ├── ClearanceRequest.js  # One request per student, status: pending/completed
    │   ├── ClearanceItem.js     # One per personnel per request, staged workflow
    │   ├── Notification.js      # In-app notifications
    │   └── Certificate.js       # Issued on full clearance completion
    ├── controllers/
    │   ├── authController.js    # Register, login, get current user
    │   ├── clearanceController.js  # Submit/view requests, approve/reject/resubmit items
    │   ├── notificationController.js  # List + mark-read notifications
    │   ├── chatbotController.js # AI chatbot queries
    │   └── adminController.js   # Personnel management, analytics, search, overrides
    ├── routes/
    │   ├── index.js             # Mounts all sub-routers under /api
    │   ├── authRoutes.js
    │   ├── clearanceRoutes.js
    │   ├── notificationRoutes.js
    │   ├── chatbotRoutes.js
    │   └── adminRoutes.js
    ├── middlewares/
    │   ├── auth.js              # JWT protect + role authorize
    │   └── errorHandler.js      # 404 handler + global error normalizer
    ├── services/
    │   ├── workflowService.js        # Staged approval: initialize items, advance stages
    │   ├── categorizationService.js  # AI #3: rejection auto-categorization (Gemini)
    │   ├── chatbotService.js         # AI #4: RAG chatbot (Gemini)
    │   ├── delayReminderService.js   # SLA enforcement + daily sweep
    │   └── notificationService.js    # In-app + email notification dispatch
    ├── jobs/
    │   └── delayReminderJob.js  # Cron: runs the delay reminder sweep
    ├── templates/
    │   └── emailTemplates.js    # Styled HTML email templates
    └── utils/
        ├── logger.js            # Custom logger (console + file, color-coded)
        ├── ApiError.js          # Custom error class with HTTP status codes
        ├── asyncHandler.js      # Async/await error wrapper for controllers
        ├── apiResponse.js       # Consistent success response shape
        ├── geminiClient.js      # Shared Google Gemini API caller
        ├── emailClient.js       # Nodemailer SMTP wrapper
        └── seed.js              # Creates default admin + personnel accounts
```

---

## Prerequisites

- **Node.js** ≥ 18 (uses native `fetch`)
- **MongoDB** — local instance or MongoDB Atlas
- **npm**

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env — at minimum set MONGO_URI and JWT_SECRET

# 3. Seed default accounts (admin + 5 personnel)
npm run seed

# 4. Start the server
npm start
# or with auto-reload:
npx nodemon server.js
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `MONGO_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Secret key for signing JWTs (use a long random string) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiry duration |
| `DELAY_REMINDER_CRON` | No | `0 8 * * *` | Cron schedule for the SLA reminder sweep |
| `SLA_DAYS` | No | `7` | Number of days before an item is considered overdue |
| `SMTP_HOST` | No | — | SMTP server (e.g. `smtp.gmail.com`). If blank, emails are skipped. |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password or app-specific password |
| `SMTP_FROM` | No | `no-reply@clearance.local` | Sender address for emails |
| `GEMINI_API_KEY` | No | — | Google Gemini API key. If blank, AI features fall back to rule-based logic. |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model to use |
| `FRONTEND_URL` | No | `http://localhost:3000` | Used in email template links |

---

## Seeded Accounts

Run `npm run seed` to create the following test accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@clearance.local` | `Admin@12345` |
| Personnel (Library) | `library@clearance.local` | `Personnel@12345` |
| Personnel (Bursary) | `bursary@clearance.local` | `Personnel@12345` |
| Personnel (Hostel) | `hostel@clearance.local` | `Personnel@12345` |
| Personnel (HOD) | `head.of.department@clearance.local` | `Personnel@12345` |
| Personnel (Student Affairs) | `student.affairs@clearance.local` | `Personnel@12345` |

Register a student via `POST /api/auth/register`.

---

## Running the Server

```bash
# Production
npm start

# Development (auto-reload)
npx nodemon server.js
```

The server starts on `http://localhost:5000` (or the configured `PORT`). The delay reminder cron job activates automatically on startup.

---

## Approval Workflow

The clearance process follows a **three-stage sequential pipeline**:

```
Stage 1: Head of Department (HOD)
    │  must approve before anything else can proceed
    ▼
Stage 2: Library, Hostel, Student Affairs, etc.
    │  act in any order (parallel), once HOD has approved
    ▼
Stage 3: Bursary
    │  only unlocked once ALL Stage 2 offices have approved
    ▼
✅ All approved → Request marked 'completed' → Certificate issued
```

**Key rules:**
- A student can only have **one pending request** at a time.
- Items start as `locked` and become `pending` (actionable) when it's that personnel's turn.
- A **rejection** halts the chain — later stages stay locked until the issue is resolved.
- Students can **resubmit** rejected items with notes/documents; personnel can also **unreject** items.
- The SLA clock starts when an item is unlocked (`unlockedAt`), not when the request was created.
- Admins can **reassign** items to different personnel or **force-approve** items in emergencies.

---

## AI Components

### AI #3 — Rejection Auto-Categorization

When a personnel officer rejects an item with a free-text reason, the system automatically classifies it into one of four categories:

| Category | Examples |
|----------|----------|
| `Missing Document` | transcript, certificate, form, attachment |
| `Unpaid Fee` | fee, payment, balance, debt |
| `Disciplinary` | misconduct, violation, sanction, probation |
| `Other` | anything that doesn't match above |

**With `GEMINI_API_KEY`:** Uses Gemini for intelligent classification.
**Without:** Falls back to a keyword-based rule classifier (transparent, deterministic).

### AI #4 — RAG Chatbot

Students ask natural-language questions about their clearance status. The system:

1. **Retrieves** the student's own clearance items (all statuses) + anonymized similar resolved cases.
2. **Generates** an answer constrained to only the retrieved context (no hallucination).

**With `GEMINI_API_KEY`:** Uses Gemini to compose a natural-language answer.
**Without:** Returns a structured rule-based summary of the student's clearance status.

### SLA Delay Reminders

A scheduled cron job (default: daily at 8 AM) scans for pending items that have been waiting longer than the SLA target (default: 7 days) and:

- Sends a **private reminder** to the responsible personnel (notification + email).
- Sends **at most one reminder per item per day** to avoid spam.
- Only the late personnel is notified — no one else.

---

## Notifications

Every notification flows through `notificationService.notify()` and is dispatched on two channels:

1. **In-app** — a `Notification` document stored in MongoDB, visible in the user's dashboard.
2. **Email** — a styled HTML email sent via SMTP (configurable). Email failures are logged but never block the calling workflow.

### Notification Types

| Type | Recipient | Trigger |
|------|-----------|---------|
| `clearance_pending` | Personnel | A new item is awaiting their review |
| `clearance_approved` | Student | An item was approved |
| `clearance_rejected` | Student | An item was rejected |
| `clearance_completed` | Student | All items approved, certificate issued |
| `delay_reminder` | Personnel | SLA exceeded on a pending item |

---

## Error Handling

The system uses a layered error-handling approach:

1. **`ApiError`** — custom error class with static factory methods:
   - `ApiError.badRequest(message)` → 400
   - `ApiError.unauthorized(message)` → 401
   - `ApiError.forbidden(message)` → 403
   - `ApiError.notFound(message)` → 404
   - `ApiError.conflict(message)` → 409
   - `ApiError.internal(message)` → 500

2. **`asyncHandler`** — wraps async controller functions so rejected promises are forwarded to Express's error pipeline.

3. **`errorHandler` middleware** — normalizes Mongoose validation/cast/duplicate-key errors and JWT errors into `ApiError` instances, then returns a consistent JSON response:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": ["Optional array of validation errors"]
}
```

In development mode, unexpected errors also include a `stack` trace.

---

## Logging

`src/utils/logger.js` — zero-dependency, color-coded logger:

| Level | Color | File Output |
|-------|-------|-------------|
| `ERROR` | Red | `logs/error.log` + `logs/combined.log` |
| `WARN` | Yellow | `logs/combined.log` |
| `INFO` | Cyan | `logs/combined.log` |
| `DEBUG` | Gray | `logs/combined.log` |

The `logs/` directory is created automatically on first use.

---

## API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

For complete request/response documentation with examples, see **[`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)**.

| Group | Endpoints | Access |
|-------|-----------|--------|
| **Auth** | Register, login, current user | Public / Authenticated |
| **Clearance (Student)** | Submit request, view status, get estimate, get certificate, resubmit | Student |
| **Clearance (Personnel)** | Pending queue, approve, reject, unreject, statistics, history | Personnel |
| **Clearance (Shared)** | View item detail | Student / Personnel / Admin |
| **Notifications** | List, mark read, mark all read | Authenticated |
| **Chatbot** | Ask a question | Student |
| **Admin** | Personnel CRUD, student listing, item management, analytics, dashboard, search, reassign, override | Admin |
| **Health** | Health check | Public |

---

## License

ISC
