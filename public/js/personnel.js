// personnel.js - the page for office staff (library, bursary, etc.).

// The lists are kept here so the search boxes can filter them without
// asking the backend again.
let queueItems = [];
let reviewedItems = [];


// True if the student's name or reg. number contains the typed text.
function matchesSearch(item, text) {
  if (text === '') {
    return true;
  }
  const name = fieldOf(item.student, 'name');
  const regNumber = fieldOf(item.student, 'regNumber');
  const combined = (name + ' ' + regNumber).toLowerCase();
  return combined.indexOf(text.toLowerCase()) !== -1;
}


// Links to documents the student attached when resubmitting (web links only).
function documentLinks(item) {
  const documents = item.resubmissionDocuments || [];
  let html = '';
  documents.forEach(function (doc) {
    if (doc.url.indexOf('http') === 0) {
      html += `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">${escapeHtml(doc.name)}</a> `;
    }
  });
  return html;
}


/* ---------- Queue tab ---------- */

async function loadQueue() {
  const data = await api('/clearance/items/pending');
  queueItems = data.items;
  drawQueue();
}


function drawQueue() {
  const searchText = $('#queue-search').value;
  const rows = [];

  queueItems.forEach(function (item) {
    if (!matchesSearch(item, searchText)) {
      return; // skip items that do not match the search
    }

    const waiting = daysSince(item.unlockedAt);
    const waitingClass = waiting >= 7 ? 'late' : '';

    rows.push([
      escapeHtml(fieldOf(item.student, 'name')),
      escapeHtml(formatReg(fieldOf(item.student, 'regNumber'))),
      `<span class="${waitingClass}">${waiting} day(s)</span>`,
      escapeHtml(item.resubmissionNote) + ' ' + documentLinks(item),
      `
        <button class="btn btn-small approve-button" data-id="${item._id}">Approve</button>
        <button class="btn btn-small btn-danger reject-button" data-id="${item._id}">Reject</button>
      `,
    ]);
  });

  $('#queue-list').innerHTML = buildTable(
    ['Student', 'Reg. no.', 'Waiting', 'Resubmission', ''],
    rows,
    'Nothing is waiting on you.'
  );

  onClickAll('.approve-button', approveItem);
  onClickAll('.reject-button', rejectItem);
}


function approveItem(itemId, button) {
  tryAction(async function () {
    if (!confirm('Approve this clearance item?')) {
      return;
    }

    setLoading(button, true);
    await api('/clearance/items/' + itemId + '/approve', { method: 'PATCH' });
    showToast('Approved');

    // Take the row out straight away so the page feels instant,
    // then quietly reload the real list in the background.
    removeFromQueue(itemId);
    tryAction(loadQueue);
  }, button);
}


function rejectItem(itemId, button) {
  tryAction(async function () {
    const answers = await askForm('Reject item', [
      { name: 'reason', label: 'Reason (the student will see this)', type: 'textarea', required: true },
    ], 'Reject');

    if (!answers) {
      return;
    }

    setLoading(button, true);
    await api('/clearance/items/' + itemId + '/reject', {
      method: 'PATCH',
      body: { reason: answers.reason },
    });
    showToast('Rejected');

    removeFromQueue(itemId);
    tryAction(loadQueue);
  }, button);
}


function removeFromQueue(itemId) {
  queueItems = queueItems.filter(function (item) {
    return item._id !== itemId;
  });
  drawQueue();
}


/* ---------- History tab ---------- */

async function loadHistory() {
  const data = await api('/clearance/personnel/history');
  reviewedItems = data.items;
  drawHistory();
}


function drawHistory() {
  const searchText = $('#history-search').value;
  const decision = $('#history-status').value;
  const rows = [];

  reviewedItems.forEach(function (item) {
    const searchOk = matchesSearch(item, searchText);
    const decisionOk = decision === '' || item.status === decision;
    if (!searchOk || !decisionOk) {
      return;
    }

    let action = '';
    if (item.status === 'rejected') {
      action = `<button class="btn btn-small btn-outline reopen-button" data-id="${item._id}">Reopen</button>`;
    }

    rows.push([
      escapeHtml(fieldOf(item.student, 'name')),
      escapeHtml(formatReg(fieldOf(item.student, 'regNumber'))),
      statusBadge(item.status),
      `${escapeHtml(item.rejectionReason)} <small>${escapeHtml(item.rejectionCategory)}</small>`,
      formatDate(item.respondedAt),
      action,
    ]);
  });

  $('#history-list').innerHTML = buildTable(
    ['Student', 'Reg. no.', 'Decision', 'Reason', 'Date', ''],
    rows,
    'No reviewed items match.'
  );

  onClickAll('.reopen-button', reopenItem);
}


function reopenItem(itemId, button) {
  tryAction(async function () {
    if (!confirm('Reopen this item? It goes back to your queue.')) {
      return;
    }

    setLoading(button, true);
    await api('/clearance/items/' + itemId + '/unreject', { method: 'PATCH' });
    showToast('Item reopened');

    // It is no longer a finished item, so take it out of this list.
    reviewedItems = reviewedItems.filter(function (item) {
      return item._id !== itemId;
    });
    drawHistory();
  }, button);
}


/* ---------- Statistics tab ---------- */

async function loadStats() {
  const stats = await api('/clearance/personnel/statistics');

  const cards = [
    { label: 'Waiting', value: stats.pendingCount },
    { label: 'Reviewed', value: stats.totalReviewed },
    { label: 'Approved', value: stats.approvedCount },
    { label: 'Rejected', value: stats.rejectedCount },
    { label: 'Approval rate', value: stats.approvalRatio + '%' },
    { label: 'Avg. response (days)', value: stats.avgResponseDays },
  ];

  let html = '';
  cards.forEach(function (card, index) {
    const cssClass = index === 0 ? 'stat highlight' : 'stat';
    html += `
      <div class="${cssClass}">
        <strong>${card.value}</strong>
        <small>${card.label}</small>
      </div>
    `;
  });
  $('#stats-list').innerHTML = html;
}


/* ---------- Live search / filter boxes ---------- */

$('#queue-search').addEventListener('input', drawQueue);
$('#history-search').addEventListener('input', drawHistory);
$('#history-status').addEventListener('change', drawHistory);


/* ---------- Start the page ----------
   This must stay at the bottom: it opens the first tab straight away, and that
   tab's code needs every variable and function above to exist already. */

startPage('personnel', [
  { id: 'queue', label: 'Queue', load: loadQueue },
  { id: 'history', label: 'History', load: loadHistory },
  { id: 'stats', label: 'Statistics', load: loadStats },
]);
