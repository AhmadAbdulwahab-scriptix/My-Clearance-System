// index.js - sign in, registration and "forgot password".

// Where each kind of user goes after signing in.
const HOME_PAGE = {
  student: 'student.html',
  personnel: 'personnel.html',
  admin: 'admin.html',
};

// If the user is already signed in, skip this page.
if (currentUser && localStorage.getItem('token')) {
  location.href = HOME_PAGE[currentUser.role];
}


// Shows one of the three forms and hides the other two.
// name is 'login', 'register' or 'forgot'.
function showForm(name) {
  $('#login-form').hidden = name !== 'login';
  $('#register-form').hidden = name !== 'register';
  $('#forgot-form').hidden = name !== 'forgot';
}

$('#show-register').addEventListener('click', function () {
  showForm('register');
});

$('#show-login').addEventListener('click', function () {
  showForm('login');
});

$('#show-forgot').addEventListener('click', function () {
  $('#forgot-notice').hidden = true;
  showForm('forgot');
});

$('#back-to-login').addEventListener('click', function () {
  showForm('login');
});


// Sign in and registration work the same way: send the form to the backend,
// save the token it returns, then go to the user's page.
function connectForm(form, path) {
  onSubmit(form, async function () {
    const body = readForm(form);
    if (body.regNumber) {
      body.regNumber = body.regNumber.trim().toUpperCase(); // saved in capitals
    }
    const data = await api(path, { method: 'POST', body: body });

    saveSession(data.token, data.user);
    location.href = HOME_PAGE[data.user.role];
  });
}

connectForm($('#login-form'), '/auth/login');
connectForm($('#register-form'), '/auth/register');


// Forgot password: ask the backend to email a reset link.
onSubmit($('#forgot-form'), async function () {
  await api('/auth/forgot-password', { method: 'POST', body: readForm($('#forgot-form')) });

  // The backend gives the same answer whether or not the email exists, so
  // nobody can use this form to find out who has an account.
  const notice = $('#forgot-notice');
  notice.textContent =
    'If an account with that email exists, a reset link is on its way. ' +
    'Check your inbox and your spam folder. The link works for 30 minutes.';
  notice.hidden = false;
});
