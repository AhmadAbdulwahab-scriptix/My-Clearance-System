// ui.js - small helpers and the page shell (header, tabs, notifications).
// Needs api.js to be loaded first.


/* ---------- Icons (small inline pictures, so nothing has to be downloaded) ---------- */

const ICONS = {
  bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  chevron: '<svg class="chevron-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
};


/* ---------- Small helpers ---------- */

function $(selector) {
  return document.querySelector(selector);
}


// Stops text from the database being treated as HTML.
// Always use it when putting user text inside an HTML string.
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// Registration numbers are always shown in capital letters.
function formatReg(regNumber) {
  if (!regNumber) {
    return '';
  }
  return String(regNumber).toUpperCase();
}


// Safely read one field of an object that might be missing (null).
// fieldOf(item.student, 'name') gives '' if item.student does not exist.
function fieldOf(object, field) {
  if (!object) {
    return '';
  }
  return object[field];
}


function formatDate(date) {
  if (!date) {
    return '-';
  }
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}


// Date and time together, for example "21 Oct 2026, 14:05"
function formatDateTime(date) {
  if (!date) {
    return '-';
  }
  return new Date(date).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


function daysSince(date) {
  if (!date) {
    return 0;
  }
  const milliseconds = Date.now() - new Date(date).getTime();
  return Math.floor(milliseconds / (1000 * 60 * 60 * 24));
}


function statusBadge(status) {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}


// Turns { search: 'ali', year: '' } into "?search=ali" (empty values are skipped).
function buildQuery(filters) {
  const parts = [];
  for (const key in filters) {
    if (filters[key]) {
      parts.push(key + '=' + encodeURIComponent(filters[key]));
    }
  }
  if (parts.length === 0) {
    return '';
  }
  return '?' + parts.join('&');
}


// Reads every field of a form into a plain object: { fieldName: value }
function readForm(form) {
  const data = {};
  const formData = new FormData(form);
  formData.forEach(function (value, key) {
    data[key] = value;
  });
  return data;
}


// Builds an HTML table.
//   headers: ['Name', 'Status']
//   rows:    [ ['Ali', '<span>..</span>'], ['Sade', '...'] ]   (each cell is HTML text)
function buildTable(headers, rows, emptyMessage) {
  if (rows.length === 0) {
    return `<p class="muted">${emptyMessage || 'Nothing to show.'}</p>`;
  }

  let html = '<table><tr>';
  headers.forEach(function (header) {
    html += `<th>${header}</th>`;
  });
  html += '</tr>';

  rows.forEach(function (cells) {
    html += '<tr>';
    cells.forEach(function (cell) {
      html += `<td>${cell}</td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  return html;
}


// Attaches a click handler to every element matching the selector.
// The handler receives the element's data-id value.
function onClickAll(selector, handler) {
  document.querySelectorAll(selector).forEach(function (element) {
    element.addEventListener('click', function () {
      handler(element.dataset.id, element);
    });
  });
}


// Connects ONE button to an action. While the action runs, the button
// shows a spinner and cannot be clicked again.
function onClick(button, action) {
  button.addEventListener('click', function () {
    tryAction(async function () {
      setLoading(button, true);
      await action();
    }, button);
  });
}


// Connects a form to an action. It stops the browser reloading the page and
// shows a spinner on the button that was pressed.
function onSubmit(form, action) {
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const button = event.submitter; // the submit button that was clicked
    tryAction(async function () {
      setLoading(button, true);
      await action(event);
    }, button);
  });
}


/* ---------- Messages and popups ---------- */

// We remember where the last button was clicked, so messages can pop up
// right next to it. (The third argument, true, makes this run before the
// button's own click handler.)
let lastClick = null;

document.addEventListener('click', function (event) {
  const button = event.target.closest('button');
  if (button) {
    lastClick = {
      button: button,
      rect: button.getBoundingClientRect(),
      time: Date.now(),
    };
  }
}, true);


// Puts the message box above the button that was just clicked.
// If there is no room above, it goes below. It never leaves the screen.
function placeToast(toast) {
  const margin = 10;
  const width = toast.offsetWidth;
  const height = toast.offsetHeight;

  // Default position: bottom centre of the screen
  let left = (window.innerWidth - width) / 2;
  let top = window.innerHeight - height - 30;

  // Use the clicked button if the click was recent
  if (lastClick && Date.now() - lastClick.time < 20000) {
    let rect = lastClick.rect;
    if (lastClick.button.isConnected) {
      rect = lastClick.button.getBoundingClientRect(); // up-to-date position
    }
    left = rect.left + rect.width / 2 - width / 2;
    top = rect.top - height - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
  }

  // Keep it inside the screen
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

  toast.style.left = left + 'px';
  toast.style.top = top + 'px';
}


// Shows a small message that fades out by itself.
function showToast(message, isError) {
  // Create the message box the first time it is needed
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
  }

  // Popup windows sit on top of the page, so if one is open the message
  // has to live inside it, otherwise it would be hidden behind it.
  const openDialog = document.querySelector('dialog[open]');
  const host = openDialog || document.body;
  if (toast.parentElement !== host) {
    host.append(toast);
  }

  const icon = isError ? '!' : '&#10003;';
  toast.className = isError ? 'error' : 'success';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;

  placeToast(toast);
  toast.classList.add('show');

  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, isError ? 3800 : 2600);
}


// Shows or hides the spinner inside a button.
function setLoading(button, isLoading) {
  if (!button) {
    return;
  }
  button.classList.toggle('loading', isLoading);
  button.disabled = isLoading;
}


// Runs an async function and shows any error as a message.
// If a button is given, its spinner is always switched off at the end.
async function tryAction(action, button) {
  try {
    await action();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(button, false);
  }
}


// Dims a list while it is being reloaded, so the user sees something is happening.
function refreshing(element, loader) {
  element.classList.add('refreshing');
  return tryAction(loader).then(function () {
    element.classList.remove('refreshing');
  });
}


// Opens a small popup form and waits for the user.
// Returns { fieldName: value }, or null if the user cancels.
//
// fields example:
//   { name: 'reason', label: 'Reason', type: 'textarea', required: true }
//   { name: 'officer', label: 'Officer', type: 'select', options: [{ value: '1', label: 'Library' }] }
//   { name: 'note', label: 'Note' }            <- plain text box when type is left out
function askForm(title, fields, buttonText) {
  return new Promise(function (resolve) {
    let inputs = '';

    fields.forEach(function (field) {
      const required = field.required ? 'required' : '';
      let control = '';

      if (field.type === 'textarea') {
        control = `<textarea name="${field.name}" rows="3" ${required}></textarea>`;
      } else if (field.type === 'select') {
        let optionsHtml = '';
        field.options.forEach(function (option) {
          optionsHtml += `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
        });
        control = `<select name="${field.name}" ${required}>${optionsHtml}</select>`;
      } else {
        control = `<input name="${field.name}" ${required}>`;
      }

      inputs += `<label>${escapeHtml(field.label)}${control}</label>`;
    });

    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <form method="dialog">
        <h3>${escapeHtml(title)}</h3>
        ${inputs}
        <div class="row row-end">
          <button class="btn btn-danger" value="cancel" formnovalidate>Cancel</button>
          <button class="btn" value="ok">${escapeHtml(buttonText || 'Save')}</button>
        </div>
      </form>
    `;
    document.body.append(dialog);
    dialog.showModal();

    // When the popup closes, send the answers back to whoever asked.
    dialog.addEventListener('close', function () {
      let answers = null;
      if (dialog.returnValue === 'ok') {
        answers = readForm(dialog.querySelector('form'));
      }
      dialog.remove();
      resolve(answers);
    });
  });
}


/* ---------- Notifications (the bell in the header) ---------- */

async function loadNotifications() {
  const data = await api('/notifications/my');
  const notifications = data.notifications;

  let unreadCount = 0;
  notifications.forEach(function (n) {
    if (!n.read) {
      unreadCount++;
    }
  });

  // The red number on the bell (hidden when there is nothing unread)
  const badge = $('#unread-count');
  badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
  badge.hidden = unreadCount === 0;

  // Build the list (show the latest 30)
  let listHtml = '';
  notifications.slice(0, 30).forEach(function (n) {
    const cssClass = n.read ? 'notification' : 'notification unread';
    listHtml += `
      <div class="${cssClass}" data-id="${n._id}">
        ${escapeHtml(n.message)}
        <small>${formatDate(n.createdAt)}</small>
      </div>
    `;
  });
  if (listHtml === '') {
    listHtml = '<p class="muted">No notifications yet.</p>';
  }

  const markAllButton = unreadCount > 0
    ? '<button class="link-button" id="mark-all-read">Mark all read</button>'
    : '';

  $('#notification-list').innerHTML = `
    <div class="row">
      <strong>Notifications</strong>
      ${markAllButton}
    </div>
    ${listHtml}
  `;

  // Click handlers
  const markAll = $('#mark-all-read');
  if (markAll) {
    markAll.addEventListener('click', function () {
      tryAction(async function () {
        await api('/notifications/mark-all-read', { method: 'PATCH' });
        loadNotifications();
      });
    });
  }

  onClickAll('.notification.unread', function (id) {
    tryAction(async function () {
      await api('/notifications/' + id + '/read', { method: 'PATCH' });
      loadNotifications();
    });
  });
}


/* ---------- Page shell: header + tabs ---------- */

// Builds the header and the tab bar, then opens the first tab.
//
//   role: the role allowed on this page ('student', 'personnel' or 'admin')
//   tabs: [ { id: 'queue', label: 'Queue', load: loadQueue }, ... ]
//         each tab needs a <section id="tab-queue"> in the page's HTML.
function startPage(role, tabs) {
  // Not signed in, or the wrong kind of user: go back to the sign-in page.
  const hasToken = localStorage.getItem('token');
  if (!currentUser || !hasToken || currentUser.role !== role) {
    logout();
    return;
  }

  let officeText = '';
  if (currentUser.officeName) {
    officeText = ', ' + escapeHtml(currentUser.officeName);
  }

  document.body.insertAdjacentHTML('afterbegin', `
    <header class="top-bar">
      <div class="brand">
        <strong>Student Clearance</strong>
        <span>Department of Software Engineering</span>
      </div>
      <div class="user-area">
        <span class="user-name">${escapeHtml(currentUser.name)}${officeText}</span>
        <button class="link-button sign-out-desktop" id="sign-out">Sign out</button>
      </div>
      <button class="bell-button" id="bell" aria-label="Notifications">
        ${ICONS.bell}
        <span class="bell-badge" id="unread-count" hidden></span>
      </button>
      <div class="card notification-list" id="notification-list" hidden></div>
    </header>

    <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="tabs">
      ${ICONS.menu}
      <span>Menu</span>
      <span class="menu-current" id="menu-current"></span>
      ${ICONS.chevron}
    </button>
    <nav class="tabs" id="tabs"></nav>
  `);

  $('#sign-out').addEventListener('click', logout);
  $('#bell').addEventListener('click', function () {
    const list = $('#notification-list');
    list.hidden = !list.hidden;
  });

  // Phones: the tabs are hidden behind the Menu button.
  $('#menu-toggle').addEventListener('click', function () {
    const isOpen = $('#tabs').classList.toggle('open');
    this.setAttribute('aria-expanded', isOpen);
  });

  // Which tab to open first? The one named in the address (#items), so a
  // refresh keeps you where you were. Otherwise the first tab.
  let startIndex = 0;
  tabs.forEach(function (tab, index) {
    if ('#' + tab.id === location.hash) {
      startIndex = index;
    }
  });

  // One button per tab
  const nav = $('#tabs');
  tabs.forEach(function (tab, index) {
    const button = document.createElement('button');
    button.textContent = tab.label;
    button.addEventListener('click', function () {
      openTab(tab, button);
    });
    nav.append(button);

    if (index === startIndex) {
      openTab(tab, button);
    }
  });

  // Phones: Sign out sits at the bottom of the menu (hidden on bigger screens).
  const menuSignOut = document.createElement('button');
  menuSignOut.className = 'menu-signout';
  menuSignOut.textContent = 'Sign out';
  menuSignOut.addEventListener('click', logout);
  nav.append(menuSignOut);

  tryAction(loadNotifications);
  setInterval(function () {
    loadNotifications().catch(function () {});
  }, 60000);
}


// Shows one tab's section, hides the others, and loads its data.
function openTab(tab, button) {
  // highlight the clicked tab button
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.classList.remove('active');
  });
  button.classList.add('active');

  // phones: show the open tab's name on the Menu button and close the menu
  $('#menu-current').textContent = tab.label;
  $('#tabs').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');

  // remember this tab in the address bar (without adding a history entry)
  history.replaceState(null, '', '#' + tab.id);

  // show only this tab's section
  document.querySelectorAll('main > section').forEach(function (section) {
    section.hidden = section.id !== 'tab-' + tab.id;
  });

  const section = $('#tab-' + tab.id);

  // This tab is still loading from an earlier click: just show it. Do not start
  // a second load and do not add a second spinner.
  if (section.dataset.loading === 'yes') {
    return;
  }
  section.dataset.loading = 'yes';

  // Show "Loading..." the first time, remove it when the data has arrived.
  const firstTime = !section.dataset.loaded;
  if (firstTime) {
    section.insertAdjacentHTML('afterbegin', `
      <div class="loading-box loading-text">
        <div class="spinner spinner-large"></div>
        <span>Loading...</span>
      </div>
    `);
  }

  tryAction(tab.load).then(function () {
    section.querySelectorAll('.loading-text').forEach(function (el) {
      el.remove();
    });
    section.dataset.loaded = 'yes';
    section.dataset.loading = 'no';
  });
}
