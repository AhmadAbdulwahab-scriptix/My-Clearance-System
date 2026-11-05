// document-viewer.js - Personnel document viewer modal

/**
 * Initialize the document viewer modal
 * Call this once when the page loads
 */
function initDocumentViewer() {
  const modal = document.getElementById('document-viewer-modal');
  if (!modal) {
    return;
  }

  const closeBtn = document.getElementById('document-viewer-close');
  const doneBtn = document.getElementById('document-viewer-done');
  const overlay = modal.querySelector('.modal-overlay');

  // Close modal handlers
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDocumentViewer);
  }
  if (doneBtn) {
    doneBtn.addEventListener('click', closeDocumentViewer);
  }
  if (overlay) {
    overlay.addEventListener('click', closeDocumentViewer);
  }
}

/**
 * Open the document viewer modal with item details
 * @param {Object} item - The clearance item with resubmissionDocuments
 */
function openDocumentViewer(item) {
  const modal = document.getElementById('document-viewer-modal');
  if (!modal) return;

  const documents = item.resubmissionDocuments || [];
  const note = item.resubmissionNote || '(No note provided)';
  const resolvedAt = item.resubmissionResolution?.resolvedAt;

  // Update info section
  const noteEl = document.getElementById('viewer-note');
  const countEl = document.getElementById('viewer-count');
  const dateEl = document.getElementById('viewer-date');

  if (noteEl) noteEl.textContent = note;
  if (countEl) countEl.textContent = documents.length;
  if (dateEl) {
    dateEl.textContent = resolvedAt
      ? formatDateTime(new Date(resolvedAt))
      : '—';
  }

  // Render document list
  renderDocumentList(documents);

  // Show modal
  modal.hidden = false;
}

/**
 * Close the document viewer modal
 */
function closeDocumentViewer() {
  const modal = document.getElementById('document-viewer-modal');
  if (modal) modal.hidden = true;
}

/**
 * Render the document list UI
 * @param {Array} documents - Array of document objects
 */
function renderDocumentList(documents) {
  const listEl = document.getElementById('document-list');
  if (!listEl) return;

  if (documents.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No documents uploaded</p>
      </div>
    `;
    return;
  }

  let html = '<div class="document-items">';

  documents.forEach((doc) => {
    const fileName = doc.originalFileName || doc.name || 'Document';
    const fileSize = doc.fileSize
      ? formatFileSize(doc.fileSize)
      : 'Unknown size';
    const fileFormat = doc.fileFormat || 'unknown';
    const icon = getDocumentIcon(fileFormat);
    const url = doc.secure_url || doc.url;

    html += `
      <div class="document-item">
        <div class="document-header">
          <span class="document-icon">${icon}</span>
          <div class="document-info-text">
            <div class="document-name">${escapeHtml(fileName)}</div>
            <div class="document-meta">
              ${escapeHtml(fileFormat.toUpperCase())} •
              ${fileSize}
            </div>
          </div>
        </div>
        <div class="document-actions">
          ${
            url
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-small">
                   Open
                 </a>`
              : '<span class="muted">No URL</span>'
          }
        </div>
      </div>
    `;
  });

  html += '</div>';
  listEl.innerHTML = html;
}

/**
 * Get icon based on file format
 * @param {string} fileFormat - File format/extension
 * @returns {string} emoji icon
 */
function getDocumentIcon(fileFormat) {
  if (fileFormat === 'pdf') return '📄';
  if (fileFormat && fileFormat.match(/^(jpg|jpeg)$/)) return '🖼️';
  if (fileFormat === 'png') return '🖼️';
  return '📎';
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
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
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date/time for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

// Initialize viewer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDocumentViewer);
} else {
  initDocumentViewer();
}
