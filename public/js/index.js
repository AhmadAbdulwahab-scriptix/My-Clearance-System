// index.js - sign in and registration.

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


// Switch between the sign in form and the registration form.
function showRegisterForm(show) {
  $('#login-form').hidden = show;
  $('#register-form').hidden = !show;
}

$('#show-register').addEventListener('click', function () {
  showRegisterForm(true);
});

$('#show-login').addEventListener('click', function () {
  showRegisterForm(false);
});


// Both forms work the same way: send the form to the backend, save the
// token it returns, then go to the user's page.
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
