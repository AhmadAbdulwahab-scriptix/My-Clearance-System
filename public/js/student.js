// student.js - the student's page.

/* ---------- Clearance request tab ---------- */

async function loadRequest() {
  // 1. Get all of this student's requests (newest first).
  const myRequests = await api('/clearance/requests/my');
  const requests = myRequests.requests;
  const current = requests[0];

  // 2. No request yet: show the "Start clearance" card.
  if (!current) {
    showStartCard();
    $('#certificate').innerHTML = '';
    showEarlierRequests([]);
    return;
  }

  // 3. Get the details of the current request. The calls run together
  //    (Promise.all) so the page only has to draw once.
  const id = current._id;
  let certificateCall = null;
  if (current.status === 'completed') {
    certificateCall = api('/clearance/requests/' + id + '/certificate');
  }

  const results = await Promise.all([
    api('/clearance/requests/' + id),
    api('/clearance/requests/' + id + '/estimate'),
    certificateCall,
  ]);
  const items = results[0].items;
  const estimate = results[1];
  const certificateData = results[2];

  // 4. Draw everything.
  showCurrentRequest(current, items, estimate);
  showCertificate(certificateData, items);
  showEarlierRequests(requests.slice(1));
}


function showStartCard() {
  $('#current-request').innerHTML = `
    <div class="card">
      <h2>No clearance request yet</h2>
      <p class="muted">
        Submitting a request sends it to every office in the department.
        The Head of Department reviews first, then the other offices, and the Bursary last.
      </p>
      <button class="btn" id="start-button">Start clearance</button>
    </div>
  `;

  onClick($('#start-button'), async function () {
    await api('/clearance/requests', { method: 'POST' });
    showToast('Clearance request submitted');
    loadRequest();
  });
}


// The text shown in the "Details" column for one office.
function describeItem(item, waitingDays) {
  if (item.status === 'rejected') {
    return `
      ${escapeHtml(item.rejectionReason)}
      <br>
      <small>${escapeHtml(item.rejectionCategory)}</small>
    `;
  }
  if (item.status === 'pending') {
    const days = waitingDays[item._id] || 0;
    return 'Waiting ' + days + ' day(s)';
  }
  if (item.status === 'locked') {
    return '<span class="muted">Waits for an earlier stage</span>';
  }
  return formatDateTime(item.respondedAt);
}


function showCurrentRequest(request, items, estimate) {
  // Lookup table: item id -> days waiting so far
  const waitingDays = {};
  estimate.items.forEach(function (entry) {
    waitingDays[entry.itemId] = entry.daysWaitingSoFar;
  });

  // One table row per office
  const rows = [];
  items.forEach(function (item) {
    let action = '';
    if (item.status === 'rejected') {
      action = `<button class="btn btn-small" data-id="${item._id}">Resubmit</button>`;
    }

    rows.push([
      item.stage,
      escapeHtml(fieldOf(item.personnel, 'officeName')),
      statusBadge(item.status),
      describeItem(item, waitingDays),
      action,
    ]);
  });

  $('#current-request').innerHTML = `
    <div class="card">
      <div class="row">
        <h2>Clearance request</h2>
        ${statusBadge(request.status)}
      </div>
      <p class="muted">
        Submitted ${formatDateTime(request.createdAt)}.
        Each office should respond within ${escapeHtml(estimate.expectedTurnaround.days)}.
      </p>
      <div class="table-wrap">
        ${buildTable(['Stage', 'Office', 'Status', 'Details', ''], rows)}
      </div>
    </div>
  `;

  onClickAll('#current-request [data-id]', resubmitItem);
}


function resubmitItem(itemId, button) {
  tryAction(async function () {
    const answers = await askForm('Resubmit to this office', [
      { name: 'note', label: 'What changed? (payment made, document attached, etc.)', type: 'textarea', required: true },
      { name: 'name', label: 'Document name (optional)' },
      { name: 'url', label: 'Document link (optional)' },
    ], 'Resubmit');

    if (!answers) {
      return; // the user pressed Cancel
    }

    setLoading(button, true);

    let documents = [];
    if (answers.url) {
      documents = [{ name: answers.name || 'Document', url: answers.url }];
    }

    await api('/clearance/items/' + itemId + '/resubmit', {
      method: 'PATCH',
      body: { note: answers.note, documents: documents },
    });

    showToast('Resubmitted');
    loadRequest();
  }, button);
}


/* ---------- Certificate ---------- */

// The link stored inside the QR code. Scanning it opens the public verify page.
// SITE_URL comes from config.js. When it is empty we use the address the
// student is on right now, which on the deployed site is the real domain.
function certificateQrText(certificate) {
  const site = SITE_URL !== '' ? SITE_URL : location.origin;
  return site + '/verify.html?code=' + encodeURIComponent(certificate.certificateCode);
}


// Turns text into a QR code picture (an SVG). Uses the small qrcode.js library.
function buildQrCode(text) {
  const qr = qrcode(0, 'M'); // 0 = pick the size automatically, 'M' = medium error correction
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}


function showCertificate(certificateData, items) {
  if (!certificateData) {
    $('#certificate').innerHTML = '';
    return;
  }
  const certificate = certificateData.certificate;

  // The list of offices that approved, in stage order
  const approved = items.filter(function (item) {
    return item.status === 'approved';
  });
  approved.sort(function (a, b) {
    return a.stage - b.stage;
  });

  const approvalRows = [];
  approved.forEach(function (item, index) {
    approvalRows.push([
      index + 1,
      escapeHtml(fieldOf(item.personnel, 'officeName')),
      statusBadge(item.status),
    ]);
  });

  $('#certificate').innerHTML = `
    <div class="card cert-toolbar">
      <div class="row">
        <div>
          <h2>Your clearance certificate is ready</h2>
          <p class="muted">Click Print to see it. Choose "Save as PDF" in the print window to keep a copy.</p>
        </div>
        <button class="btn" id="print-button">Print certificate</button>
      </div>
    </div>

    <article class="certificate">
      <header class="cert-header">
        <img class="cert-logo" id="cert-logo" src="img/buk-logo.png" alt="Bayero University Kano logo">
        <div class="cert-logo-fallback" id="cert-logo-fallback" hidden>BUK</div>
        <h1>Bayero University Kano</h1>
        <p class="muted">Department of Software Engineering</p>
        <h2 class="cert-title">Certificate of Clearance</h2>
      </header>

      <p class="cert-statement">
        This is to certify that <strong>${escapeHtml(currentUser.name)}</strong> has completed
        the clearance process and has been cleared by every office listed below.
      </p>

      <table class="cert-table">
        <tr><td>Full name</td><td>${escapeHtml(currentUser.name)}</td></tr>
        <tr><td>Registration number</td><td>${escapeHtml(formatReg(currentUser.regNumber))}</td></tr>
        <tr><td>Department</td><td>${escapeHtml(currentUser.department || 'Software Engineering')}</td></tr>
      </table>

      <div class="cert-qr">
        <div class="qr-box" id="qr-box"></div>
        <p class="cert-code">${escapeHtml(certificate.certificateCode)}</p>
        <small>Scan to read the certificate details</small>
      </div>

      <h3 class="cert-section">Cleared by</h3>
      ${buildTable(['No.', 'Office', 'Status'], approvalRows, 'No approvals found.')}

      <footer class="cert-footer">
        <span>Issued: ${formatDateTime(certificate.issuedAt)}</span>
        <span>Printed: <span id="printed-time">${formatDateTime(new Date())}</span></span>
      </footer>
    </article>
  `;

  // The QR code (if the library failed to load, the code text is still shown)
  if (typeof qrcode !== 'undefined') {
    $('#qr-box').innerHTML = buildQrCode(certificateQrText(certificate));
  }

  // If the logo file is missing, show the round "BUK" badge instead
  const logo = $('#cert-logo');
  logo.addEventListener('error', function () {
    logo.hidden = true;
    $('#cert-logo-fallback').hidden = false;
  });

  $('#print-button').addEventListener('click', function () {
    print();
  });
}


// Just before printing, update the "Printed" time to the exact moment of printing.
window.addEventListener('beforeprint', function () {
  const printedTime = $('#printed-time');
  if (printedTime) {
    printedTime.textContent = formatDateTime(new Date());
  }
});


function showEarlierRequests(olderRequests) {
  if (olderRequests.length === 0) {
    $('#earlier-requests').innerHTML = '';
    return;
  }

  const rows = [];
  olderRequests.forEach(function (request) {
    rows.push([formatDateTime(request.createdAt), statusBadge(request.status)]);
  });

  $('#earlier-requests').innerHTML = `
    <div class="card">
      <h3>Earlier requests</h3>
      ${buildTable(['Submitted', 'Status'], rows)}
    </div>
  `;
}


/* ---------- Assistant tab ---------- */

// The conversation is saved in the browser (one per student), so it survives a
// refresh. It is wiped when the student signs out, because logout() clears
// everything saved in localStorage.
const CHAT_KEY = 'chat-' + (currentUser ? currentUser._id : 'guest');

// chat.messages: [ { from: 'me' or 'bot', text: '...' }, ... ]
// chat.pending:  the question still waiting for an answer, or null
function loadChat() {
  const saved = localStorage.getItem(CHAT_KEY);
  if (saved === null) {
    return { messages: [], pending: null };
  }
  try {
    return JSON.parse(saved);
  } catch (error) {
    return { messages: [], pending: null }; // the saved text was damaged, start fresh
  }
}

let chat = loadChat();

function saveChat() {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
}


function drawChat() {
  let html = '';

  chat.messages.forEach(function (message) {
    const cssClass = message.from === 'me' ? 'message mine' : 'message';
    html += `<div class="${cssClass}">${escapeHtml(message.text)}</div>`;
  });

  if (chat.pending) {
    html += '<div class="message typing"><span class="spinner"></span> Typing...</div>';
  }

  if (html === '') {
    html = '<p class="muted">No messages yet. Ask your first question below.</p>';
  }

  const chatBox = $('#chat-box');
  chatBox.innerHTML = html;
  chatBox.scrollTop = chatBox.scrollHeight;
}


// Sends one question to the backend and saves the answer.
async function getAnswer(question) {
  try {
    const data = await api('/chatbot/query', { method: 'POST', body: { question: question } });
    chat.messages.push({ from: 'bot', text: data.answer });
  } finally {
    // Finished, with an answer or with an error: nothing is waiting any more.
    chat.pending = null;
    saveChat();
    drawChat();
  }
}


onSubmit($('#chat-form'), async function () {
  const question = $('#question').value.trim();
  if (question === '') {
    return;
  }
  $('#question').value = '';

  // Save the question BEFORE asking, so a refresh cannot lose it.
  chat.messages.push({ from: 'me', text: question });
  chat.pending = question;
  saveChat();
  drawChat();

  await getAnswer(question);
});


// If the page was refreshed while the assistant was still typing, the answer
// was lost on the way. The question was saved, so ask it again.
function resumePendingQuestion() {
  if (!chat.pending) {
    return;
  }
  const button = $('#chat-form .btn');
  tryAction(async function () {
    setLoading(button, true);
    await getAnswer(chat.pending);
  }, button);
}


$('#clear-chat').addEventListener('click', function () {
  if (chat.pending) {
    showToast('Wait for the reply first', true);
    return;
  }
  chat = { messages: [], pending: null };
  saveChat();
  drawChat();
});


/* ---------- Start the page ----------
   This must stay at the bottom: it opens the first tab straight away, and that
   tab's code needs every variable and function above to exist already. */

startPage('student', [
  { id: 'request', label: 'My clearance', load: loadRequest },
  { id: 'assistant', label: 'Assistant', load: drawChat },
]);

drawChat();
resumePendingQuestion();
