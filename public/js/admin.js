// admin.js - the administrator's page.

// A row of "number cards". cards = [ { label: 'Students', value: 20 }, ... ]
function buildStatCards(cards) {
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
  return html;
}


/* ---------- Overview tab ---------- */

async function loadOverview() {
  const data = await api('/admin/dashboard');

  $('#overview-stats').innerHTML = buildStatCards([
    { label: 'Students', value: data.totalStudents },
    { label: 'Pending clearances', value: data.pendingClearances },
    { label: 'Completed today', value: data.completedToday },
    { label: 'Completed this week', value: data.completedThisWeek },
    { label: 'Avg. completion (days)', value: data.avgCompletionDays },
    { label: 'Rejections', value: data.totalRejections },
  ]);

  const rows = [];
  data.bottleneckOffices.forEach(function (office) {
    rows.push([
      escapeHtml(office.officeName),
      escapeHtml(office.personnelName),
      office.pendingCount,
    ]);
  });
  $('#overview-offices').innerHTML = buildTable(['Office', 'Officer', 'Pending'], rows);
}


/* ---------- Students tab ---------- */

async function loadStudents() {
  // Every filter field in the form is sent to the backend as a query string.
  const filters = readForm($('#students-filter'));
  const data = await api('/admin/students' + buildQuery(filters));

  $('#students-count').textContent = data.count + ' student(s) found';

  const rows = [];
  data.students.forEach(function (student) {
    rows.push([
      escapeHtml(student.name),
      escapeHtml(formatReg(student.regNumber)),
      escapeHtml(student.email),
      escapeHtml(student.department),
      formatDate(student.createdAt),
      `<button class="btn btn-small btn-outline view-student" data-id="${student._id}">View</button>`,
    ]);
  });

  $('#students-list').innerHTML = buildTable(
    ['Name', 'Reg. no.', 'Email', 'Department', 'Registered', ''],
    rows
  );

  onClickAll('.view-student', openStudentDetail);
}

onSubmit($('#students-filter'), loadStudents);

// Phones: the arrow inside the Search box shows or hides the other filters.
$('#filters-toggle').addEventListener('click', function () {
  const isOpen = $('#students-filters').classList.toggle('open');
  this.setAttribute('aria-expanded', isOpen);
  this.setAttribute('aria-label', isOpen ? 'Hide more filters' : 'Show more filters');
});

onClick($('#students-reset'), function () {
  $('#students-filter').reset();
  return loadStudents();
});


// Opens the popup with one student's requests, offices and certificate.
function openStudentDetail(studentId, button) {
  tryAction(async function () {
    setLoading(button, true);
    const data = await api('/admin/students/' + studentId);
    const student = data.student;

    let html = `
      <div class="row">
        <h2>${escapeHtml(student.name)}</h2>
        <button class="btn btn-danger btn-small" id="close-detail">Close</button>
      </div>
      <p class="muted">
        ${escapeHtml(formatReg(student.regNumber))} &middot; ${escapeHtml(student.email)}
      </p>
    `;

    if (data.requests.length === 0) {
      html += '<p>This student has not started clearance yet.</p>';
    }

    data.requests.forEach(function (request) {
      const rows = [];
      request.items.forEach(function (item) {
        rows.push([
          item.stage,
          escapeHtml(fieldOf(item.personnel, 'officeName')),
          statusBadge(item.status),
          escapeHtml(item.rejectionReason),
          itemActionButtons(item),
        ]);
      });

      let certificateText = '';
      if (request.certificate) {
        certificateText = `<p>Certificate: <strong>${escapeHtml(request.certificate.certificateCode)}</strong></p>`;
      }

      html += `
        <h3 style="margin-top: 18px">
          Request of ${formatDate(request.createdAt)} ${statusBadge(request.status)}
        </h3>
        ${certificateText}
        <div class="table-wrap">
          ${buildTable(['Stage', 'Office', 'Status', 'Reason', ''], rows)}
        </div>
      `;
    });

    const dialog = $('#student-detail');
    dialog.innerHTML = html;
    if (!dialog.open) {
      dialog.showModal();
    }

    $('#close-detail').addEventListener('click', function () {
      dialog.close();
    });

    // After an action, load the student's details again so they are up to date.
    function refresh() {
      openStudentDetail(studentId);
    }
    onClickAll('#student-detail .reassign-button', function (id, actionButton) {
      reassignItem(id, refresh, actionButton);
    });
    onClickAll('#student-detail .override-button', function (id, actionButton) {
      overrideItem(id, refresh, actionButton);
    });
  }, button);
}


/* ---------- Reassign / approve buttons (used by two places) ---------- */

// Approved items need no buttons. Everything else can be reassigned or approved.
function itemActionButtons(item) {
  if (item.status === 'approved') {
    return '';
  }
  return `
    <button class="btn btn-small btn-outline reassign-button" data-id="${item._id}">Reassign</button>
    <button class="btn btn-small override-button" data-id="${item._id}">Approve</button>
  `;
}


// Moves an item to a different officer. afterDone() runs when it succeeds.
function reassignItem(itemId, afterDone, button) {
  tryAction(async function () {
    // Get the list of active officers for the dropdown
    setLoading(button, true);
    const data = await api('/admin/personnel?status=active');
    setLoading(button, false);

    const options = [];
    data.personnel.forEach(function (person) {
      options.push({ value: person._id, label: person.officeName + ' - ' + person.name });
    });

    const answers = await askForm('Reassign to another officer', [
      { name: 'newPersonnelId', label: 'New officer', type: 'select', options: options },
    ], 'Reassign');

    if (!answers) {
      return;
    }

    setLoading(button, true);
    await api('/admin/clearance/items/' + itemId + '/reassign', {
      method: 'PATCH',
      body: { newPersonnelId: answers.newPersonnelId },
    });
    showToast('Item reassigned');
    afterDone();
  }, button);
}


// Approves an item on behalf of the office. A reason is required.
function overrideItem(itemId, afterDone, button) {
  tryAction(async function () {
    const answers = await askForm('Approve on behalf of the office', [
      { name: 'reason', label: 'Reason (kept in the item history)', type: 'textarea', required: true },
    ], 'Approve');

    if (!answers) {
      return;
    }

    setLoading(button, true);
    await api('/admin/clearance/items/' + itemId + '/override-approve', {
      method: 'PATCH',
      body: { reason: answers.reason },
    });
    showToast('Item approved');
    afterDone();
  }, button);
}


/* ---------- Clearance items tab ---------- */

let itemsPage = 1;

async function loadItems() {
  const filters = readForm($('#items-filter'));
  filters.page = itemsPage;
  const data = await api('/admin/items' + buildQuery(filters));

  const rows = [];
  data.items.forEach(function (item) {
    let waiting = '-';
    if (item.status === 'pending') {
      waiting = daysSince(item.unlockedAt) + ' day(s)';
    }

    const studentName = escapeHtml(fieldOf(item.student, 'name'));
    const studentReg = escapeHtml(formatReg(fieldOf(item.student, 'regNumber')));

    rows.push([
      studentName + '<br><small>' + studentReg + '</small>',
      escapeHtml(fieldOf(item.personnel, 'officeName')),
      escapeHtml(fieldOf(item.personnel, 'name')),
      statusBadge(item.status),
      waiting,
      itemActionButtons(item),
    ]);
  });

  $('#items-list').innerHTML = buildTable(
    ['Student', 'Office', 'Officer', 'Status', 'Waiting', ''],
    rows,
    'No items match these filters.'
  );

  // Previous / Next buttons
  $('#items-pager').innerHTML = `
    <span class="muted">${data.total} item(s), page ${data.page} of ${data.pages}</span>
    <span>
      <button class="btn btn-small btn-outline" id="items-prev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
      <button class="btn btn-small btn-outline" id="items-next" ${data.page >= data.pages ? 'disabled' : ''}>Next</button>
    </span>
  `;

  onClick($('#items-prev'), function () {
    itemsPage = itemsPage - 1;
    return loadItems();
  });
  onClick($('#items-next'), function () {
    itemsPage = itemsPage + 1;
    return loadItems();
  });

  // After an action, reload the list (it dims while loading).
  function reloadList() {
    refreshing($('#items-list'), loadItems);
  }
  onClickAll('#items-list .reassign-button', function (id, button) {
    reassignItem(id, reloadList, button);
  });
  onClickAll('#items-list .override-button', function (id, button) {
    overrideItem(id, reloadList, button);
  });
}

onSubmit($('#items-filter'), function () {
  itemsPage = 1; // new filters always start at page 1
  return loadItems();
});

onClick($('#items-reset'), function () {
  $('#items-filter').reset();
  itemsPage = 1;
  return loadItems();
});


/* ---------- Personnel tab ---------- */

async function loadPersonnel() {
  const status = $('#personnel-status').value;
  const data = await api('/admin/personnel' + buildQuery({ status: status }));

  const rows = [];
  data.personnel.forEach(function (person) {
    // The button flips the account between active and inactive.
    let newStatus = 'active';
    let buttonText = 'Activate';
    let buttonClass = 'btn-outline';
    if (person.status === 'active') {
      newStatus = 'inactive';
      buttonText = 'Deactivate';
      buttonClass = 'btn-danger'; // red, because it switches an account off
    }

    rows.push([
      escapeHtml(person.officeName),
      escapeHtml(person.name),
      escapeHtml(person.email),
      person.stage,
      statusBadge(person.status),
      `<button class="btn btn-small ${buttonClass} status-button" data-id="${person._id}" data-status="${newStatus}">${buttonText}</button>`,
    ]);
  });

  $('#personnel-list').innerHTML = buildTable(
    ['Office', 'Name', 'Email', 'Stage', 'Status', ''],
    rows
  );

  document.querySelectorAll('.status-button').forEach(function (button) {
    button.addEventListener('click', function () {
      changePersonnelStatus(button.dataset.id, button.dataset.status, button);
    });
  });
}


function changePersonnelStatus(personnelId, newStatus, button) {
  tryAction(async function () {
    setLoading(button, true);
    await api('/admin/personnel/' + personnelId + '/status', {
      method: 'PATCH',
      body: { status: newStatus },
    });
    showToast('Status updated');
    refreshing($('#personnel-list'), loadPersonnel);
  }, button);
}

$('#personnel-status').addEventListener('change', function () {
  refreshing($('#personnel-list'), loadPersonnel);
});

onSubmit($('#personnel-form'), async function (event) {
  const form = event.target;
  await api('/admin/personnel', { method: 'POST', body: readForm(form) });
  form.reset();
  showToast('Account created');
  loadPersonnel();
});


/* ---------- Analytics tab ---------- */

async function loadAnalytics() {
  // Two independent calls, sent together.
  const results = await Promise.all([
    api('/admin/analytics/rejections'),
    api('/admin/analytics/bottlenecks'),
  ]);
  const rejections = results[0].breakdown;
  const bottlenecks = results[1].bottlenecks;

  // Bars: the biggest count gets the longest bar.
  let biggest = 1;
  rejections.forEach(function (entry) {
    if (entry.count > biggest) {
      biggest = entry.count;
    }
  });

  let barsHtml = '';
  rejections.forEach(function (entry) {
    const width = (entry.count / biggest) * 60; // percent of the row
    barsHtml += `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(entry._id || 'Uncategorised')}</span>
        <div class="bar-fill" style="width: ${width}%"></div>
        <span>${entry.count}</span>
      </div>
    `;
  });
  if (barsHtml === '') {
    barsHtml = '<p class="muted">No rejections yet.</p>';
  }
  $('#rejection-bars').innerHTML = barsHtml;

  // The backend sends durations in milliseconds, so convert to days.
  const rows = [];
  bottlenecks.forEach(function (entry) {
    const days = (entry.avgDurationMs / (1000 * 60 * 60 * 24)).toFixed(1);
    rows.push([
      escapeHtml(entry.name),
      escapeHtml(entry.officeName),
      days,
      entry.resolvedCount,
    ]);
  });
  $('#bottleneck-list').innerHTML = buildTable(
    ['Officer', 'Office', 'Avg. days', 'Items resolved'],
    rows
  );
}


/* ---------- Search tab ---------- */

onSubmit($('#search-form'), async function (event) {
  const text = readForm(event.target).q;
  const data = await api('/admin/search' + buildQuery({ q: text }));
  const rows = [];

  data.students.forEach(function (student) {
    rows.push([
      'Student',
      escapeHtml(student.name),
      escapeHtml(formatReg(student.regNumber)) + ', ' + escapeHtml(student.email),
    ]);
  });

  data.personnel.forEach(function (person) {
    rows.push([
      'Officer',
      escapeHtml(person.name),
      escapeHtml(person.officeName) + ', ' + escapeHtml(person.email) + ' ' + statusBadge(person.status),
    ]);
  });

  data.certificates.forEach(function (certificate) {
    const name = escapeHtml(fieldOf(certificate.student, 'name'));
    const reg = escapeHtml(formatReg(fieldOf(certificate.student, 'regNumber')));
    rows.push(['Certificate', escapeHtml(certificate.certificateCode), name + ' (' + reg + ')']);
  });

  $('#search-results').innerHTML = `
    <p class="muted">${data.totalResults} result(s)</p>
    ${buildTable(['Type', 'Name', 'Details'], rows)}
  `;
});


/* ---------- Start the page ----------
   This must stay at the bottom: it opens the first tab straight away, and that
   tab's code needs every variable and function above to exist already. */

startPage('admin', [
  { id: 'overview', label: 'Overview', load: loadOverview },
  { id: 'students', label: 'Students', load: loadStudents },
  { id: 'items', label: 'Clearance items', load: loadItems },
  { id: 'personnel', label: 'Personnel', load: loadPersonnel },
  { id: 'analytics', label: 'Analytics', load: loadAnalytics },
  { id: 'search', label: 'Search', load: function () {} },
]);
