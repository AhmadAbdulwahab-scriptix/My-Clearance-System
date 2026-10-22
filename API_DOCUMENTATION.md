# API Documentation

> AI-Assisted Student Clearance System — Complete REST API Reference

**Base URL:** `http://localhost:5000/api`

All protected routes require the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

- [Response Format](#response-format)
- [Error Format](#error-format)
- [Authentication](#1-authentication)
- [Clearance — Student](#2-clearance--student)
- [Clearance — Personnel](#3-clearance--personnel)
- [Clearance — Shared](#4-clearance--shared)
- [Notifications](#5-notifications)
- [Chatbot](#6-chatbot)
- [Admin](#7-admin)
- [Health Check](#8-health-check)
- [Data Models](#data-models)

---

## Response Format

All successful responses follow this shape:

```json
{
  "success": true,
  "message": "Human-readable status message",
  "data": { ... }
}
```

## Error Format

All error responses follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": ["Optional array of validation errors"],
  "stack": "Stack trace (development mode only, for unexpected errors)"
}
```

### Standard Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad Request — missing or invalid input |
| `401` | Unauthorized — missing, invalid, or expired token |
| `403` | Forbidden — valid token but insufficient role/permissions |
| `404` | Not Found — resource doesn't exist |
| `409` | Conflict — duplicate resource (e.g. email already registered) |
| `500` | Internal Server Error — unexpected failure |

---

## 1. Authentication

### POST `/api/auth/register`

Register a new user account.

**Access:** Public

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | Yes | Unique email address |
| `password` | string | Yes | Minimum 6 characters |
| `role` | string | No | `student` (default), `personnel`, or `admin` |
| `matricNumber` | string | Conditional | Required if `role` is `student` |
| `officeName` | string | Conditional | Required if `role` is `personnel` |
| `department` | string | No | Default: `Software Engineering` |

**Example Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "student",
  "matricNumber": "CST/22/SWE/0001"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "664a1b2c3d4e5f6789abcdef",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student",
      "regNumber": null,
      "department": "Software Engineering",
      "createdAt": "2026-10-20T10:30:00.000Z",
      "updatedAt": "2026-10-20T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `name, email, and password are required` |
| `400` | `matricNumber is required for students` |
| `400` | `officeName is required for personnel` |
| `409` | `An account with this email already exists` |

---

### POST `/api/auth/login`

Authenticate a user and receive a JWT token.

**Access:** Public

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

**Example Request:**

```json
{
  "email": "admin@clearance.local",
  "password": "Admin@12345"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "664a1b2c3d4e5f6789abcdef",
      "name": "System Administrator",
      "email": "admin@clearance.local",
      "role": "admin",
      "department": "Software Engineering",
      "createdAt": "2026-10-20T10:00:00.000Z",
      "updatedAt": "2026-10-20T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `email and password are required` |
| `401` | `Invalid email or password` |

---

### GET `/api/auth/me`

Get the currently authenticated user's profile.

**Access:** Authenticated (any role)

**Headers:** `Authorization: Bearer <token>`

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Current user fetched",
  "data": {
    "user": {
      "_id": "664a1b2c3d4e5f6789abcdef",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student",
      "department": "Software Engineering",
      "createdAt": "2026-10-20T10:30:00.000Z",
      "updatedAt": "2026-10-20T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `401` | `Authentication token missing` |
| `401` | `Invalid authentication token` |
| `401` | `Authentication token expired` |
| `401` | `User belonging to this token no longer exists` |

---

## 2. Clearance — Student

All endpoints require authentication as a **student**.

### POST `/api/clearance/requests`

Submit a new clearance request. The system auto-generates one `ClearanceItem` per active personnel, staged by the approval workflow (HOD → other offices → Bursary).

**Access:** Student

**Request Body:** None

**Success Response:** `201 Created`

```json
{
  "success": true,
  "message": "Clearance request submitted",
  "data": {
    "request": {
      "_id": "664b2c3d4e5f67890abcdef1",
      "student": "664a1b2c3d4e5f6789abcdef",
      "status": "pending",
      "completedAt": null,
      "createdAt": "2026-10-20T11:00:00.000Z",
      "updatedAt": "2026-10-20T11:00:00.000Z"
    },
    "items": [
      {
        "_id": "664b2c3d4e5f67890abcdef2",
        "request": "664b2c3d4e5f67890abcdef1",
        "student": "664a1b2c3d4e5f6789abcdef",
        "personnel": "664a1b2c3d4e5f6789abc001",
        "stage": 1,
        "status": "pending",
        "unlockedAt": "2026-10-20T11:00:00.000Z"
      },
      {
        "_id": "664b2c3d4e5f67890abcdef3",
        "request": "664b2c3d4e5f67890abcdef1",
        "student": "664a1b2c3d4e5f6789abcdef",
        "personnel": "664a1b2c3d4e5f6789abc002",
        "stage": 2,
        "status": "locked",
        "unlockedAt": null
      }
    ]
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `409` | `You already have a pending clearance request` |
| `500` | `No active personnel are configured for this department yet` |
| `500` | `No active Head of Department account is configured; cannot start the approval sequence` |
| `500` | `No active Stage 2 office personnel are configured; clearance would stall after HOD approval` |
| `500` | `No active Bursary account is configured; clearance could never be finalized` |

---

### GET `/api/clearance/requests/my`

List all clearance requests for the current student, newest first.

**Access:** Student

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "requests": [
      {
        "_id": "664b2c3d4e5f67890abcdef1",
        "student": "664a1b2c3d4e5f6789abcdef",
        "status": "pending",
        "completedAt": null,
        "createdAt": "2026-10-20T11:00:00.000Z"
      }
    ]
  }
}
```

---

### GET `/api/clearance/requests/:id`

Full status breakdown of one request, with all clearance items and their states.

**Access:** Student (owner only), Personnel, Admin

**URL Params:** `id` — ClearanceRequest ObjectId

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Request status fetched",
  "data": {
    "request": {
      "_id": "664b2c3d4e5f67890abcdef1",
      "student": "664a1b2c3d4e5f6789abcdef",
      "status": "pending",
      "completedAt": null
    },
    "items": [
      {
        "_id": "664b2c3d4e5f67890abcdef2",
        "status": "approved",
        "stage": 1,
        "personnel": {
          "_id": "664a1b2c3d4e5f6789abc001",
          "name": "Head of Department Officer",
          "officeName": "Head of Department",
          "stage": 1
        },
        "rejectionReason": null,
        "rejectionCategory": null
      },
      {
        "_id": "664b2c3d4e5f67890abcdef3",
        "status": "pending",
        "stage": 2,
        "personnel": {
          "_id": "664a1b2c3d4e5f6789abc002",
          "name": "Library Officer",
          "officeName": "Library",
          "stage": 2
        }
      }
    ]
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance request not found` |
| `403` | `You cannot view another student's request` |

---

### GET `/api/clearance/requests/:id/estimate`

Get the institutional SLA and how long each currently-pending item has been waiting.

**Access:** Student (owner only), Personnel, Admin

**URL Params:** `id` — ClearanceRequest ObjectId

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Estimate fetched",
  "data": {
    "expectedTurnaround": {
      "days": "7 days (1 week)"
    },
    "items": [
      {
        "itemId": "664b2c3d4e5f67890abcdef3",
        "personnel": "Library Officer",
        "officeName": "Library",
        "daysWaitingSoFar": 3
      }
    ]
  }
}
```

---

### GET `/api/clearance/requests/:id/certificate`

Fetch the clearance certificate for a completed request.

**Access:** Student (owner only), Personnel, Admin

**URL Params:** `id` — ClearanceRequest ObjectId

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Certificate fetched",
  "data": {
    "certificate": {
      "_id": "664c3d4e5f67890abcdef001",
      "request": "664b2c3d4e5f67890abcdef1",
      "student": "664a1b2c3d4e5f6789abcdef",
      "certificateCode": "CLR-1729425600000-A1B2C3",
      "issuedAt": "2026-10-20T15:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance request not found` |
| `403` | `You cannot view another student's certificate` |
| `404` | `Certificate not yet issued for this request` |

---

### PATCH `/api/clearance/items/:id/resubmit`

Resubmit a rejected item with updated information and/or documents. Resets the item to pending status and restarts the SLA timer.

**Access:** Student (item owner only)

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `note` | string | No | Explanation or additional information |
| `documents` | array | No | Array of `{ name: string, url: string }` objects |

**Example Request:**

```json
{
  "note": "I have uploaded the missing transcript.",
  "documents": [
    {
      "name": "Transcript.pdf",
      "url": "https://storage.example.com/uploads/transcript.pdf"
    }
  ]
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item resubmitted successfully",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "status": "pending",
      "resubmissionNote": "I have uploaded the missing transcript.",
      "resubmissionDocuments": [
        {
          "name": "Transcript.pdf",
          "url": "https://storage.example.com/uploads/transcript.pdf",
          "uploadedAt": "2026-10-20T14:00:00.000Z"
        }
      ],
      "resubmissionHistory": [
        {
          "action": "rejected",
          "actor": "664a1b2c3d4e5f6789abc002",
          "reason": "Missing transcript",
          "timestamp": "2026-10-18T10:00:00.000Z"
        },
        {
          "action": "resubmitted",
          "actor": "664a1b2c3d4e5f6789abcdef",
          "reason": "I have uploaded the missing transcript.",
          "timestamp": "2026-10-20T14:00:00.000Z"
        }
      ]
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance item not found` |
| `403` | `You can only resubmit your own items` |
| `400` | `This item is not currently rejected` |

---

## 3. Clearance — Personnel

All endpoints require authentication as **personnel**.

### GET `/api/clearance/items/pending`

Get the personnel's queue of currently actionable (pending) items. Locked items do not appear.

**Access:** Personnel

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Pending items fetched",
  "data": {
    "items": [
      {
        "_id": "664b2c3d4e5f67890abcdef2",
        "request": "664b2c3d4e5f67890abcdef1",
        "status": "pending",
        "stage": 1,
        "unlockedAt": "2026-10-20T11:00:00.000Z",
        "student": {
          "_id": "664a1b2c3d4e5f6789abcdef",
          "name": "John Doe",
          "regNumber": "CST/22/SWE/0001"
        }
      }
    ]
  }
}
```

---

### PATCH `/api/clearance/items/:id/approve`

Approve a clearance item. Triggers workflow advancement (unlocking the next stage) and checks if the full request is now complete.

**Access:** Personnel (assigned to this item only)

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:** None

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item approved",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef2",
      "status": "approved",
      "respondedAt": "2026-10-20T12:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance item not found` |
| `403` | `You can only act on items assigned to you` |
| `400` | `This item is not currently actionable (already resolved, or not yet your turn)` |

---

### PATCH `/api/clearance/items/:id/reject`

Reject a clearance item with a reason. The reason is auto-categorized by AI Component 3.

**Access:** Personnel (assigned to this item only)

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | Yes |

**Example Request:**

```json
{
  "reason": "Student has not submitted their library borrowing clearance form"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item rejected",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "status": "rejected",
      "rejectionReason": "Student has not submitted their library borrowing clearance form",
      "rejectionCategory": "Missing Document",
      "respondedAt": "2026-10-20T13:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `A rejection reason is required` |
| `404` | `Clearance item not found` |
| `403` | `You can only act on items assigned to you` |
| `400` | `This item is not currently actionable (already resolved, or not yet your turn)` |

---

### PATCH `/api/clearance/items/:id/unreject`

Revert a rejection back to pending status. Resets the SLA timer. Useful when a student addresses issues externally.

**Access:** Personnel (assigned to this item only)

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:** None

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item unrejected and reset to pending",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "status": "pending",
      "rejectionReason": null,
      "rejectionCategory": null,
      "respondedAt": null,
      "unlockedAt": "2026-10-20T14:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance item not found` |
| `403` | `You can only act on items assigned to you` |
| `400` | `This item is not currently rejected` |

---

### GET `/api/clearance/personnel/statistics`

Get the current personnel's own performance statistics.

**Access:** Personnel

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Personnel statistics fetched",
  "data": {
    "totalReviewed": 25,
    "pendingCount": 3,
    "approvedCount": 20,
    "rejectedCount": 5,
    "avgResponseDays": 2.3,
    "approvalRatio": 80
  }
}
```

---

### GET `/api/clearance/personnel/history`

Get all items the current personnel has reviewed (approved or rejected), newest first.

**Access:** Personnel

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Personnel history fetched",
  "data": {
    "items": [
      {
        "_id": "664b2c3d4e5f67890abcdef2",
        "status": "approved",
        "respondedAt": "2026-10-20T12:00:00.000Z",
        "student": {
          "_id": "664a1b2c3d4e5f6789abcdef",
          "name": "John Doe",
          "regNumber": "CST/22/SWE/0001"
        }
      }
    ],
    "count": 1
  }
}
```

---

## 4. Clearance — Shared

### GET `/api/clearance/items/:id`

Get full details of a single clearance item, including resubmission history.

**Access:** Student (item owner), Personnel (assigned), or Admin

**URL Params:** `id` — ClearanceItem ObjectId

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item details fetched",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "request": "664b2c3d4e5f67890abcdef1",
      "status": "rejected",
      "stage": 2,
      "rejectionReason": "Missing transcript",
      "rejectionCategory": "Missing Document",
      "unlockedAt": "2026-10-19T11:00:00.000Z",
      "respondedAt": "2026-10-20T13:00:00.000Z",
      "resubmissionNote": null,
      "resubmissionDocuments": [],
      "resubmissionHistory": [
        {
          "action": "rejected",
          "actor": "664a1b2c3d4e5f6789abc002",
          "reason": "Missing transcript",
          "timestamp": "2026-10-20T13:00:00.000Z"
        }
      ],
      "personnel": {
        "_id": "664a1b2c3d4e5f6789abc002",
        "name": "Library Officer",
        "officeName": "Library",
        "stage": 2
      },
      "student": {
        "_id": "664a1b2c3d4e5f6789abcdef",
        "name": "John Doe",
        "regNumber": "CST/22/SWE/0001",
        "email": "john@example.com"
      }
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Clearance item not found` |
| `403` | `You do not have permission to view this item` |

---

## 5. Notifications

All endpoints require authentication (any role).

### GET `/api/notifications/my`

List all notifications for the current user, newest first.

**Access:** Authenticated

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Notifications fetched",
  "data": {
    "notifications": [
      {
        "_id": "664d4e5f67890abcdef00001",
        "recipient": "664a1b2c3d4e5f6789abcdef",
        "message": "Your clearance item with Library has been approved.",
        "type": "clearance_approved",
        "relatedItem": "664b2c3d4e5f67890abcdef3",
        "read": false,
        "createdAt": "2026-10-20T12:00:00.000Z"
      }
    ]
  }
}
```

---

### PATCH `/api/notifications/:id/read`

Mark a single notification as read.

**Access:** Authenticated (recipient only)

**URL Params:** `id` — Notification ObjectId

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "664d4e5f67890abcdef00001",
      "read": true
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Notification not found` |
| `403` | `You cannot modify another user's notification` |

---

### PATCH `/api/notifications/mark-all-read`

Mark all unread notifications as read for the current user.

**Access:** Authenticated

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 5
  }
}
```

---

## 6. Chatbot

### POST `/api/chatbot/query`

Ask the AI clearance assistant a question about your clearance status.

The chatbot retrieves your clearance data (all items, all statuses) plus anonymized similar resolved cases, then generates an answer using Gemini AI (or a rule-based summary if no API key is configured).

**Access:** Student

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `question` | string | Yes |

**Example Request:**

```json
{
  "question": "Why was my library clearance rejected and what should I do?"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Answer generated",
  "data": {
    "question": "Why was my library clearance rejected and what should I do?",
    "answer": "Your Library clearance was rejected because of a missing transcript (Category: Missing Document). To resolve this, you can resubmit your clearance item with the required transcript attached. 3 other students with similar rejections were later approved after providing the missing documents."
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `question is required` |

---

## 7. Admin

All endpoints require authentication as **admin**.

### POST `/api/admin/personnel`

Create a new personnel account for an office.

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `email` | string | Yes |
| `password` | string | Yes |
| `officeName` | string | Yes |

**Example Request:**

```json
{
  "name": "Jane Smith",
  "email": "jane.smith@university.edu",
  "password": "StrongPass@789",
  "officeName": "Sports Office"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "message": "Personnel account created",
  "data": {
    "personnel": {
      "_id": "664e5f67890abcdef0000001",
      "name": "Jane Smith",
      "email": "jane.smith@university.edu",
      "role": "personnel",
      "officeName": "Sports Office",
      "stage": 2,
      "status": "active"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `name, email, password, and officeName are required` |
| `409` | `An account with this email already exists` |

---

### GET `/api/admin/personnel`

List all personnel accounts.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by `active` or `inactive` |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Personnel fetched",
  "data": {
    "personnel": [
      {
        "_id": "664a1b2c3d4e5f6789abc001",
        "name": "Bursary Officer",
        "email": "bursary@clearance.local",
        "role": "personnel",
        "officeName": "Bursary",
        "stage": 3,
        "status": "active"
      }
    ],
    "count": 5
  }
}
```

---

### PATCH `/api/admin/personnel/:id/status`

Toggle a personnel account between active and inactive.

**URL Params:** `id` — User ObjectId (personnel)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `active` or `inactive` |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Personnel status updated",
  "data": {
    "personnel": {
      "_id": "664a1b2c3d4e5f6789abc001",
      "name": "Bursary Officer",
      "status": "inactive"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `status must be either "active" or "inactive"` |
| `404` | `Personnel not found` |

---

### GET `/api/admin/students`

List all students with optional filters.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `year` | string | Filter by year in registration number |
| `status` | string | `approved` (completed) or `pending` |
| `search` | string | Search by name or registration number |
| `hasRejection` | string | `true` to filter students with rejected items |
| `rejectionCategory` | string | `Missing Document`, `Unpaid Fee`, `Disciplinary`, or `Other` |
| `department` | string | Filter by department |
| `createdAfter` | string | ISO date — requests created after this date |
| `createdBefore` | string | ISO date — requests created before this date |
| `overdueDays` | string | Students waiting longer than N days |
| `sort` | string | Sort field (prefix with `-` for descending). Default: `-createdAt` |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Students fetched",
  "data": {
    "students": [
      {
        "_id": "664a1b2c3d4e5f6789abcdef",
        "name": "John Doe",
        "email": "john@example.com",
        "regNumber": "CST/22/SWE/0001",
        "department": "Software Engineering"
      }
    ],
    "count": 1
  }
}
```

---

### GET `/api/admin/students/:id`

Get detailed information for one student, including all requests, items, and certificates.

**URL Params:** `id` — User ObjectId (student)

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Student fetched",
  "data": {
    "student": {
      "_id": "664a1b2c3d4e5f6789abcdef",
      "name": "John Doe",
      "email": "john@example.com",
      "regNumber": "CST/22/SWE/0001"
    },
    "requests": [
      {
        "_id": "664b2c3d4e5f67890abcdef1",
        "status": "completed",
        "completedAt": "2026-10-20T15:00:00.000Z",
        "items": [
          {
            "status": "approved",
            "stage": 1,
            "personnel": { "name": "HOD Officer", "officeName": "Head of Department", "stage": 1 }
          }
        ],
        "certificate": {
          "certificateCode": "CLR-1729425600000-A1B2C3",
          "issuedAt": "2026-10-20T15:00:00.000Z"
        }
      }
    ]
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `404` | `Student not found` |

---

### GET `/api/admin/items`

List all clearance items in the system with optional filters and pagination.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `locked`, `pending`, `approved`, or `rejected` |
| `personnel` | string | User ObjectId — filter by assigned personnel |
| `student` | string | User ObjectId — filter by student |
| `search` | string | Search by student name or registration number |
| `overdueDays` | string | Pending items waiting at least N days |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 200) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Items fetched",
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "pages": 2
  }
}
```

---

### GET `/api/admin/requests`

List all clearance requests with their items and progress counts.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `pending` or `completed` |
| `student` | string | User ObjectId |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "requests": [
      {
        "_id": "664b2c3d4e5f67890abcdef1",
        "student": { "name": "John Doe", "regNumber": "CST/22/SWE/0001", "email": "john@example.com" },
        "status": "pending",
        "items": [ ... ],
        "progress": { "approved": 2, "total": 5 }
      }
    ],
    "total": 10,
    "page": 1,
    "pages": 1
  }
}
```

---

### GET `/api/admin/dashboard`

System-wide dashboard overview with key metrics.

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Dashboard overview fetched",
  "data": {
    "totalStudents": 150,
    "pendingClearances": 42,
    "completedToday": 5,
    "completedThisWeek": 18,
    "avgCompletionDays": 4.2,
    "bottleneckOffices": [
      {
        "officeName": "Library",
        "personnelName": "Library Officer",
        "pendingCount": 12
      }
    ],
    "totalRejections": 8
  }
}
```

---

### GET `/api/admin/analytics/rejections`

Rejection breakdown by category (powered by AI Component 3's classification output).

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Rejection analytics fetched",
  "data": {
    "breakdown": [
      { "_id": "Missing Document", "count": 15 },
      { "_id": "Unpaid Fee", "count": 8 },
      { "_id": "Disciplinary", "count": 3 },
      { "_id": "Other", "count": 2 }
    ]
  }
}
```

---

### GET `/api/admin/analytics/bottlenecks`

Average response time per personnel officer, measured from when an item became actionable (`unlockedAt`). Sorted slowest first.

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Bottleneck analytics fetched",
  "data": {
    "bottlenecks": [
      {
        "personnelId": "664a1b2c3d4e5f6789abc002",
        "name": "Library Officer",
        "officeName": "Library",
        "avgDurationMs": 432000000,
        "resolvedCount": 20
      }
    ]
  }
}
```

> **Note:** `avgDurationMs` is in milliseconds. Divide by `86400000` to get days.

---

### PATCH `/api/admin/clearance/items/:id/reassign`

Reassign a clearance item to a different personnel (e.g., when someone goes on leave).

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `newPersonnelId` | string | Yes |

**Example Request:**

```json
{
  "newPersonnelId": "664a1b2c3d4e5f6789abc005"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item reassigned successfully",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "personnel": "664a1b2c3d4e5f6789abc005",
      "stage": 2
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `newPersonnelId is required` |
| `404` | `Clearance item not found` |
| `404` | `New personnel not found or inactive` |

---

### PATCH `/api/admin/clearance/items/:id/override-approve`

Force-approve a clearance item (for emergency/special cases). Triggers workflow advancement and request completion checks.

**URL Params:** `id` — ClearanceItem ObjectId

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `reason` | string | Yes |

**Example Request:**

```json
{
  "reason": "Student provided physical documents directly to the office"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item force-approved",
  "data": {
    "item": {
      "_id": "664b2c3d4e5f67890abcdef3",
      "status": "approved",
      "respondedAt": "2026-10-20T16:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `A reason for override is required` |
| `404` | `Clearance item not found` |
| `400` | `Item is already approved` |

---

### GET `/api/admin/search`

System-wide search across students, personnel, and certificates.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Search results fetched",
  "data": {
    "students": [
      { "_id": "...", "name": "John Doe", "email": "john@example.com", "regNumber": "CST/22/SWE/0001" }
    ],
    "personnel": [
      { "_id": "...", "name": "Library Officer", "email": "library@clearance.local", "officeName": "Library", "status": "active" }
    ],
    "certificates": [
      { "certificateCode": "CLR-1729425600000-A1B2C3", "student": { "name": "John Doe", "regNumber": "CST/22/SWE/0001" } }
    ],
    "totalResults": 3
  }
}
```

**Error Responses:**

| Code | Message |
|------|---------|
| `400` | `Search query must be at least 2 characters` |

---

## 8. Health Check

### GET `/api/health`

Simple health check to verify the API is running.

**Access:** Public

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "API is healthy"
}
```

---

## Data Models

### User

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `name` | String | Full name (required) |
| `email` | String | Unique, lowercase, trimmed (required) |
| `password` | String | Bcrypt-hashed (never returned in queries) |
| `role` | String | `student`, `personnel`, or `admin` |
| `regNumber` | String | Student registration number (unique, sparse) |
| `officeName` | String | Personnel office name (e.g. "Library", "Bursary") |
| `stage` | Number | `1` (HOD), `2` (other offices), `3` (Bursary) — auto-derived from `officeName` |
| `status` | String | `active` or `inactive` (personnel only, default: `active`) |
| `department` | String | Default: `Software Engineering` |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

### ClearanceRequest

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `student` | ObjectId | Reference to User |
| `status` | String | `pending` or `completed` |
| `completedAt` | Date | When all items were approved |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

### ClearanceItem

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `request` | ObjectId | Reference to ClearanceRequest |
| `student` | ObjectId | Reference to User |
| `personnel` | ObjectId | Reference to User |
| `status` | String | `locked`, `pending`, `approved`, or `rejected` |
| `stage` | Number | `1`, `2`, or `3` (approval sequence) |
| `rejectionReason` | String | Free-text reason for rejection |
| `rejectionCategory` | String | `Missing Document`, `Unpaid Fee`, `Disciplinary`, or `Other` |
| `unlockedAt` | Date | When this item became actionable (SLA start) |
| `respondedAt` | Date | When the personnel approved/rejected |
| `reminderCount` | Number | How many delay reminders have been sent |
| `lastReminderAt` | Date | When the last reminder was sent |
| `resubmissionNote` | String | Student's note when resubmitting |
| `resubmissionDocuments` | Array | `[{ name, url, uploadedAt }]` |
| `resubmissionHistory` | Array | `[{ action, actor, reason, timestamp }]` |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

**Indexes:**
- `{ personnel: 1, status: 1 }` — personnel queue lookups
- `{ student: 1 }` — student item lookups
- `{ request: 1, personnel: 1 }` — unique (prevents duplicate items)

### Notification

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `recipient` | ObjectId | Reference to User |
| `message` | String | Notification text |
| `type` | String | `clearance_pending`, `clearance_approved`, `clearance_rejected`, `clearance_completed`, or `delay_reminder` |
| `relatedItem` | ObjectId | Reference to ClearanceItem (optional) |
| `read` | Boolean | Default: `false` |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |

### Certificate

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `request` | ObjectId | Reference to ClearanceRequest (unique) |
| `student` | ObjectId | Reference to User |
| `certificateCode` | String | Format: `CLR-<timestamp>-<hex>` (unique) |
| `issuedAt` | Date | Default: `Date.now` |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-generated |
