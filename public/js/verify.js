// verify.js - public page that checks a certificate code. No login needed.
// It is opened by scanning the QR code on a certificate: verify.html?code=CLR-...


function showResult(html) {
  $('#result').innerHTML = html;
}


function showValid(data) {
  const student = data.student;
  showResult(`
    <div class="verify-result valid">
      <div class="verify-icon">&#10003;</div>
      <h2>Valid certificate</h2>
      <p class="muted">This certificate was issued by the Bayero University Kano clearance system.</p>

      <table class="verify-table">
        <tr><td>Name</td><td>${escapeHtml(student.name)}</td></tr>
        <tr><td>Registration number</td><td>${escapeHtml(formatReg(student.regNumber))}</td></tr>
        <tr><td>Department</td><td>${escapeHtml(student.department)}</td></tr>
        <tr><td>Certificate code</td><td>${escapeHtml(data.certificateCode)}</td></tr>
        <tr><td>Issued on</td><td>${formatDateTime(data.issuedAt)}</td></tr>
      </table>
    </div>
  `);
}


function showNotFound(code) {
  showResult(`
    <div class="verify-result invalid">
      <div class="verify-icon">!</div>
      <h2>Certificate not found</h2>
      <p class="muted">
        The code <strong>${escapeHtml(code)}</strong> does not match any certificate
        issued by this system. Check the code and try again.
      </p>
    </div>
  `);
}


function showProblem(message) {
  showResult(`
    <div class="verify-result invalid">
      <div class="verify-icon">!</div>
      <h2>Could not check right now</h2>
      <p class="muted">${escapeHtml(message)}</p>
    </div>
  `);
}


// Asks the backend about one code and shows the answer.
async function verifyCode(code) {
  code = code.trim();
  if (code === '') {
    showResult('');
    return;
  }

  showResult('<div class="loading-box"><div class="spinner spinner-large"></div><span>Checking...</span></div>');

  try {
    const data = await api('/certificates/verify/' + encodeURIComponent(code));
    showValid(data);
  } catch (error) {
    if (error.status === 404) {
      showNotFound(code); // the server answered: no such certificate
    } else {
      showProblem(error.message); // server unreachable, too many attempts, etc.
    }
  }
}


// Typing a code by hand (the printed code under the QR) works too.
onSubmit($('#lookup-form'), async function () {
  const code = readForm($('#lookup-form')).code;
  history.replaceState(null, '', '?code=' + encodeURIComponent(code.trim()));
  await verifyCode(code);
});


// If the logo file is missing, show the round "BUK" badge instead.
const logo = $('#verify-logo');
logo.addEventListener('error', function () {
  logo.hidden = true;
  $('#verify-logo-fallback').hidden = false;
});


// Opened from a QR code: the code is in the address, so check it straight away.
const codeFromAddress = new URLSearchParams(location.search).get('code');
if (codeFromAddress) {
  $('#lookup-form input[name="code"]').value = codeFromAddress;
  verifyCode(codeFromAddress);
}
