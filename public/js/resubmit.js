// resubmit.js - Resubmission modal with file upload and contextual placeholders

// Contextual placeholders for resubmission notes based on rejection category
const RESUBMISSION_CONFIG = {
  'Missing Document': {
    icon: '📄',
    label: 'What document did you upload?',
    placeholder: 'What document did you upload? (e.g., Final transcript, Medical clearance, Hostel registration)',
    hint: 'Tell us which document you\'ve provided to resolve this issue.',
    docsRequired: true,
    docsLabel: 'Upload Documents (Required)',
  },
  'Unpaid Fee': {
    icon: '💰',
    label: 'How much was sent and for what?',
    placeholder: 'How much was sent and for what? (e.g., ₦50,000 for hostel charges, ref: TXN123456)',
    hint: 'Let us know the payment details so we can verify.',
    docsRequired: true,
    docsLabel: 'Upload Payment Proof (Recommended)',
  },
  'Disciplinary': {
    icon: '⚖️',
    label: 'What did you try to fix this?',
    placeholder: 'What did you try to fix this? (e.g., I\'ve completed probation, all requirements satisfied)',
    hint: 'Explain what steps you\'ve taken to resolve the disciplinary issue.',
    docsRequired: false,
    docsLabel: 'Upload Supporting Documents (Optional)',
  },
  'Other': {
    icon: '✏️',
    label: 'What did you try to fix this?',
    placeholder: 'What did you try to fix this? Any additional context helps!',
    hint: 'Explain what steps you\'ve taken to address the rejection.',
    docsRequired: false,
    docsLabel: 'Upload Documents (Optional)',
  },
};

// Global state for file uploads
let selectedFiles = [];
let currentItemId = null;
let documentCounter = 0;

/**
 * Initialize the resubmission modal
 */
function initResubmitModal() {
  const modal = document.getElementById('resubmit-modal');
  if (!modal) {
    return;
  }

  const closeBtn = document.getElementById('resubmit-close');
  const cancelBtn = document.getElementById('resubmit-cancel');
  const overlay = document.querySelector('.modal-overlay');
  const form = document.getElementById('resubmit-form');
  const addDocBtn = document.getElementById('add-document-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeResubmitModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeResubmitModal);
  if (overlay) overlay.addEventListener('click', closeResubmitModal);
  if (form) form.addEventListener('submit', handleResubmitSubmit);
  if (addDocBtn) addDocBtn.addEventListener('click', addDocumentField);
}

/**
 * Open the resubmission modal with item details
 */
function openResubmitModal(itemId, item) {
  currentItemId = itemId;
  selectedFiles = [];
  documentCounter = 0;

  const modal = document.getElementById('resubmit-modal');
  if (!modal) return;

  const category = item.rejectionCategory || 'Other';
  const config = RESUBMISSION_CONFIG[category] || RESUBMISSION_CONFIG['Other'];

  // Update info section
  const officeEl = document.getElementById('resubmit-office');
  const reasonEl = document.getElementById('resubmit-reason');
  const categoryEl = document.getElementById('resubmit-category');

  if (officeEl) officeEl.textContent = item.personnel?.officeName || 'Unknown Office';
  if (reasonEl) reasonEl.textContent = item.rejectionReason || 'No reason provided';
  if (categoryEl) categoryEl.textContent = category;

  // Update note section labels
  const labelEl = document.getElementById('resubmit-label');
  const iconEl = document.getElementById('resubmit-icon');
  const noteEl = document.getElementById('resubmit-note');
  const hintEl = document.getElementById('resubmit-hint');

  if (labelEl) labelEl.textContent = config.label;
  if (iconEl) iconEl.textContent = config.icon;
  if (noteEl) {
    noteEl.placeholder = config.placeholder;
    noteEl.value = '';
  }
  if (hintEl) hintEl.textContent = config.hint;

  // Update documents section
  const docsLabelEl = document.getElementById('docs-label');
  const docsRequirementEl = document.getElementById('docs-requirement');
  const docsHintEl = document.getElementById('docs-hint');

  if (docsLabelEl) docsLabelEl.textContent = config.docsLabel;
  if (docsRequirementEl) {
    docsRequirementEl.textContent = config.docsRequired ? '(Required)' : '(Optional)';
    docsRequirementEl.style.color = config.docsRequired ? 'var(--danger)' : 'var(--text-muted)';
  }
  if (docsHintEl) {
    if (config.docsRequired) {
      docsHintEl.textContent = '📄 You must upload at least one document to resolve this rejection.';
      docsHintEl.style.color = 'var(--warning)';
    } else {
      docsHintEl.textContent = 'Add files one by one if you have supporting documents.';
      docsHintEl.style.color = 'var(--text-muted)';
    }
  }

  // Clear document list
  const docsList = document.getElementById('documents-list');
  if (docsList) docsList.innerHTML = '';

  // Clear progress
  const progress = document.getElementById('upload-progress');
  if (progress) progress.hidden = true;

  // Show modal
  modal.hidden = false;

  // Focus on note textarea
  if (noteEl) {
    setTimeout(() => noteEl.focus(), 100);
  }
}

/**
 * Close the resubmission modal
 */
function closeResubmitModal() {
  const modal = document.getElementById('resubmit-modal');
  if (modal) modal.hidden = true;
  selectedFiles = [];
  currentItemId = null;
  documentCounter = 0;
}

/**
 * Add a new document upload field
 */
function addDocumentField(event) {
  if (event) {
    event.preventDefault();
  }

  if (selectedFiles.length >= 5) {
    showToast('Maximum 5 documents allowed', 'error');
    return;
  }

  const docsList = document.getElementById('documents-list');
  if (!docsList) return;

  documentCounter++;
  const fieldId = `doc-field-${documentCounter}`;

  // Create the field HTML with file input that will be triggered by clicking upload area
  const fieldHtml = `
    <div class="document-field" id="${fieldId}">
      <div class="document-field-header">
        <span class="document-field-number">Document ${documentCounter}</span>
        <button
          type="button"
          class="document-field-remove"
          data-field-id="${fieldId}"
          title="Remove this document field"
        >
          ×
        </button>
      </div>

      <div class="file-upload-area file-upload-single" id="upload-area-${fieldId}">
        <input
          type="file"
          class="doc-input"
          id="file-input-${fieldId}"
          data-field-id="${fieldId}"
          accept=".pdf,.jpg,.jpeg,.png"
        >
        <div class="upload-placeholder">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            <p>Drag file here or click to browse</p>
            <small>PDF, JPG, PNG (max 10MB)</small>
          </div>
        </div>
      </div>

      <div class="document-field-preview" id="preview-${fieldId}"></div>
    </div>
  `;

  docsList.insertAdjacentHTML('beforeend', fieldHtml);

  // Get references to the newly created elements
  const newField = document.getElementById(fieldId);
  const fileInput = document.getElementById(`file-input-${fieldId}`);
  const uploadArea = document.getElementById(`upload-area-${fieldId}`);
  const removeBtn = newField.querySelector('.document-field-remove');

  // File input change handler
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files?.[0];
      if (file) {
        addFileToList(file, fieldId);
      }
    });
  }

  // Click on upload area triggers file input
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', function(e) {
      // Don't trigger if clicking on the preview
      if (e.target.closest('.document-field-preview')) {
        return;
      }
      fileInput.click();
    });
  }

  // Drag and drop handlers
  if (uploadArea) {
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', (e) => handleDropSingle(e, fieldId));
  }

  // Remove button handler
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => removeDocumentField(e, fieldId));
  }
}

/**
 * Handle single file drop
 */
function handleDropSingle(event, fieldId) {
  event.preventDefault();
  event.stopPropagation();

  const uploadArea = event.currentTarget;
  if (uploadArea) uploadArea.classList.remove('drag-over');

  const files = Array.from(event.dataTransfer.files || []);
  if (files.length > 0) {
    addFileToList(files[0], fieldId);
  }
}

/**
 * Add a single file to the list
 */
function addFileToList(file, fieldId) {
  // Validate file
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const validSize = file.size <= 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    showToast(`${file.name} is not a valid file type (PDF, JPG, PNG only)`, 'error');
    return;
  }
  if (!validSize) {
    showToast(`${file.name} exceeds 10MB limit`, 'error');
    return;
  }

  // Check for duplicates
  if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
    showToast(`${file.name} is already added`, 'error');
    return;
  }

  // Add to selected files
  selectedFiles.push({
    file: file,
    fieldId: fieldId,
    name: file.name,
    size: file.size,
    type: file.type,
  });

  // Show preview
  const previewEl = document.getElementById(`preview-${fieldId}`);
  if (previewEl) {
    previewEl.innerHTML = `
      <div class="file-preview">
        <span class="file-preview-icon">${getFileIcon(file.type)}</span>
        <div class="file-preview-info">
          <div class="file-preview-name">${escapeHtml(file.name)}</div>
          <div class="file-preview-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  }
}

/**
 * Remove a document field
 */
function removeDocumentField(event, fieldId) {
  event.preventDefault();

  selectedFiles = selectedFiles.filter(f => f.fieldId !== fieldId);

  const field = document.getElementById(fieldId);
  if (field) {
    field.remove();
  }
}

/**
 * Handle drag over event
 */
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const uploadArea = event.currentTarget;
  if (uploadArea) uploadArea.classList.add('drag-over');
}

/**
 * Handle drag leave event
 */
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const uploadArea = event.currentTarget;
  if (uploadArea) uploadArea.classList.remove('drag-over');
}

/**
 * Get icon based on file format
 */
function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  return '📎';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle form submission
 */
async function handleResubmitSubmit(event) {
  event.preventDefault();

  const note = document.getElementById('resubmit-note').value.trim();
  const category = document.getElementById('resubmit-category').textContent;
  const config = RESUBMISSION_CONFIG[category] || RESUBMISSION_CONFIG['Other'];

  // Validate note
  if (!note) {
    showToast('Please provide a note explaining what you tried to fix this', 'error');
    return;
  }

  // Validate documents based on category
  if (config.docsRequired && selectedFiles.length === 0) {
    showToast(`Please upload at least one document for "${category}" rejection`, 'error');
    return;
  }

  if (!currentItemId) {
    showToast('Error: Item ID not set', 'error');
    return;
  }

  const submitBtn = document.getElementById('resubmit-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // Build FormData
    const formData = new FormData();
    formData.append('note', note);

    // Add files
    selectedFiles.forEach(fileObj => {
      formData.append('documents', fileObj.file);
    });

    // Show progress
    const progress = document.getElementById('upload-progress');
    if (progress) progress.hidden = false;

    // Submit
    const response = await fetch(`/api/clearance/items/${currentItemId}/resubmit`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to resubmit');
    }

    showToast('Item resubmitted successfully!', 'success');
    closeResubmitModal();

    // Reload the request to show updated status
    loadRequest();

  } catch (error) {
    showToast(error.message || 'Error resubmitting item', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    const progress = document.getElementById('upload-progress');
    if (progress) progress.hidden = true;
  }
}

// Initialize modal when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResubmitModal);
} else {
  initResubmitModal();
}
