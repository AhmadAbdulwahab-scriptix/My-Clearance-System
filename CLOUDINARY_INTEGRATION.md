# Integration Summary: Landing Page + Cloudinary Resubmission Flow

## What We've Built

### 1. **Landing Page** ✅
- **File:** `public/landing.html`
- **Styles:** `public/css/landing.css`
- **Scripts:** `public/js/landing.js`
- **Route:** `/` (root) serves the landing page
- **Design:** Uses your system's violet color scheme (#6b2bd9)
- **Sections:**
  - Hero section with CTA buttons
  - Problem statement (why students need this)
  - 3-stage workflow explanation
  - 6 feature cards highlighting AI, notifications, document upload, chatbot, SLA, analytics
  - Visual 3-stage pipeline diagram
  - FAQ accordion (5 common questions)
  - Final CTA section
  - Footer with branding

**User Flow:**
- Visitors land on `/` → See landing page
- Click "Get Started" or "Sign In" → Redirected to `/login`
- `/login` serves the authentication page (formerly `index.html`, now `login.html`)

**Responsive:** Mobile-friendly with proper breakpoints

---

### 2. **Cloudinary Integration** ✅
- **Dependencies installed:** `cloudinary`, `multer`
- **Client utility:** `src/utils/cloudinaryClient.js`
  - `uploadFile(fileBuffer, fileName, folder)` - uploads to Cloudinary
  - `deleteFile(public_id)` - removes files (optional cleanup)
  
- **Middleware:** `src/middlewares/uploadMiddleware.js`
  - Accepts up to 5 files per request
  - Allowed formats: PDF, JPG, PNG, JPEG
  - Max file size: 10MB
  - Stores files in memory before uploading

- **Environment variables** (add to `.env`):
  ```
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=your_api_key
  CLOUDINARY_API_SECRET=your_api_secret
  ```

**Setup Steps:**
1. Go to https://cloudinary.com/console
2. Sign up (free tier available)
3. Copy your Cloud Name, API Key, and API Secret
4. Add them to `.env`

---

### 3. **Updated ClearanceItem Model** ✅
**Old schema:**
```javascript
resubmissionDocuments: [{
  name: String,
  url: String,
  uploadedAt: Date
}]
```

**New schema:**
```javascript
resubmissionDocuments: [{
  originalFileName: String,
  cloudinaryPublicId: String,
  secure_url: String,
  fileFormat: String,              // 'pdf', 'jpeg', 'png', etc.
  fileSize: Number,                 // in bytes
  uploadedAt: Date,
  uploadedBy: ObjectId             // reference to student
}]

resubmissionResolution: {
  rejectionCategory: String,        // mirrors rejection category
  resolutionNote: String,           // contextual note from student
  documentsCount: Number,           // how many docs uploaded
  resolvedAt: Date
}
```

---

### 4. **Contextual Resubmission Notes** ✅
File: `src/utils/resubmissionTemplates.js`

**By rejection category, show conversational placeholders:**

| Rejection Category | Icon | Placeholder |
|---|---|---|
| **Missing Document** | 📄 | "What document did you upload? (e.g., Final transcript, Medical clearance, Hostel registration)" |
| **Unpaid Fee** | 💰 | "How much was sent and for what? (e.g., ₦50,000 for hostel charges, ref: TXN123456)" |
| **Disciplinary** | ⚖️ | "What's your explanation? (e.g., I've completed probation, all requirements satisfied)" |
| **Other** | ✏️ | "Tell us how you've fixed this. Any additional context helps!" |

**Frontend Usage:**
```javascript
// When a student views a rejected item, call:
const form = getResubmissionForm(item.rejectionCategory);
// Returns: { category, icon, placeholder, hint, tone }
// Display placeholder in textarea field
```

---

### 5. **Updated Resubmit Endpoint** ✅
**Route:** `PATCH /api/clearance/items/:id/resubmit`
**Method:** Multipart form-data
**Auth:** Student only

**Request:**
```javascript
{
  note: "Uploaded final transcript for GPA requirement",
  files: [document.pdf, transcript.png]  // up to 5 files
}
```

**Flow:**
1. Validate student owns this item and it's in 'rejected' status
2. Upload files to Cloudinary (in parallel)
3. Store file metadata (URLs, file format, size)
4. Store resolution context (category, note, document count)
5. Reset item to 'pending' status
6. Restart SLA timer
7. Notify personnel to review
8. Return updated item with Cloudinary URLs

**Response:**
```javascript
{
  success: true,
  message: "Item resubmitted successfully",
  data: {
    item: {
      _id: "...",
      status: "pending",
      unlockedAt: "2026-11-05T14:15:00Z",
      resubmissionNote: "Uploaded final transcript...",
      resubmissionDocuments: [
        {
          originalFileName: "transcript.pdf",
          cloudinaryPublicId: "clearance/resubmissions/abc123",
          secure_url: "https://res.cloudinary.com/...",
          fileFormat: "pdf",
          fileSize: 245000,
          uploadedAt: "2026-11-05T14:15:00Z"
        }
      ],
      resubmissionResolution: {
        rejectionCategory: "Missing Document",
        resolutionNote: "Uploaded final transcript for GPA requirement",
        documentsCount: 1,
        resolvedAt: "2026-11-05T14:15:00Z"
      }
    }
  }
}
```

---

### 6. **Enhanced Chatbot Context** ✅
**File:** `src/services/chatbotService.js`

**Old behavior:**
```
"Similar cases: 5 other students resolved Missing Document rejections"
```

**New behavior:**
```
"At Bursary (Missing Document category): 3 students resolved by:
  - 'Uploaded final transcript for GPA requirement' (1 document: pdf)
  - 'Provided hostel payment receipt' (2 documents: pdf, image)
  - 'Submitted fee clearance form' (1 document: pdf)

Note: Your situation might be different, but these examples show what worked for others at the same office."
```

**Implementation:**
- `retrieveContext()` now groups similar cases by **office + category** (not just category)
- When a student asks a question, Gemini receives specific examples of how other students at the same office fixed the same type of rejection
- Falls back gracefully if no similar cases exist
- Conversational tone: "Your situation might be different, but..."

---

## File Changes Summary

### Created:
- `public/landing.html` - Marketing landing page
- `public/css/landing.css` - Landing page styles
- `public/js/landing.js` - Landing page interactivity
- `src/utils/cloudinaryClient.js` - Cloudinary upload utility
- `src/middlewares/uploadMiddleware.js` - Multer file upload middleware
- `src/utils/resubmissionTemplates.js` - Contextual placeholder templates

### Modified:
- `public/login.html` (renamed from `index.html`)
- `public/reset-password.html` - Updated links from `index.html` to `/login`
- `src/app.js` - Updated routing to serve landing page on `/`
- `src/models/ClearanceItem.js` - Enhanced schema with Cloudinary metadata
- `src/controllers/clearanceController.js` - Updated `resubmitItem()` for file uploads
- `src/routes/clearanceRoutes.js` - Added upload middleware to resubmit route
- `src/services/chatbotService.js` - Enhanced context retrieval by office + category
- `.env` - Added Cloudinary credentials (needs to be filled in)
- `package.json` - `cloudinary` and `multer` added to dependencies

---

## Frontend Integration (Next Steps)

When building the student dashboard UI for resubmission, you'll need:

**1. Show contextual placeholder:**
```javascript
import { getResubmissionForm } from './utils/resubmissionTemplates.js';

// When rendering rejected item detail:
const form = getResubmissionForm(item.rejectionCategory);
document.querySelector('textarea[name="note"]').placeholder = form.placeholder;
document.querySelector('.hint-text').textContent = form.hint;
document.querySelector('.icon').textContent = form.icon;
```

**2. Handle file uploads:**
```javascript
// Multipart form submission
const formData = new FormData();
formData.append('note', document.querySelector('textarea[name="note"]').value);
formData.append('documents', file1); // up to 5 files
formData.append('documents', file2);

fetch(`/api/clearance/items/${itemId}/resubmit`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

**3. Display uploaded files:**
```javascript
// After successful resubmit:
item.resubmissionDocuments.forEach(doc => {
  console.log(doc.secure_url);  // Direct Cloudinary link
  console.log(doc.fileFormat);  // 'pdf', 'jpeg', etc.
  console.log(doc.fileSize);    // in bytes
});
```

---

## Testing Checklist

- [ ] Landing page loads on `/` with all sections rendering
- [ ] Navigation links work (Sign In → `/login`)
- [ ] FAQ accordion expands/collapses correctly
- [ ] Login page loads on `/login`
- [ ] Cloudinary credentials configured in `.env`
- [ ] Student can upload 1-5 files on resubmit endpoint
- [ ] Files appear on Cloudinary dashboard
- [ ] Resubmission note placeholder matches rejection category
- [ ] Chatbot retrieves office + category context
- [ ] Personnel receives notification with document count

---

## API Documentation Update

Add to your API docs:

```markdown
### PATCH /api/clearance/items/:id/resubmit
Resubmit a rejected clearance item with documents and contextual note.

**Auth:** Bearer token (student only, must own the item)

**Content-Type:** multipart/form-data

**Body:**
- `note` (string, optional): Contextual explanation based on rejection category
- `documents` (file[], optional): 1-5 PDF/image files (max 10MB each)

**At least one of `note` or `documents` is required.**

**Response:** Updated ClearanceItem with Cloudinary metadata
```

---

## Environment Setup Complete

**You still need to:**
1. Get Cloudinary credentials from https://cloudinary.com
2. Add them to `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Test a file upload to verify integration works

---

## Next Iteration Ideas

- Add file preview before upload
- Show document deletion option (requires Cloudinary delete permission)
- Display resolution success rate by category in admin dashboard
- Add resolution templates as pre-filled suggestions
- Email to personnel includes links to Cloudinary documents
- Bulk download all resubmission documents as ZIP

