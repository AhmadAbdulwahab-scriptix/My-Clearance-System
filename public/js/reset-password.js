// reset-password.js - the page opened from the link in the reset email.

// The link looks like reset-password.html?token=abc123...
const resetToken = new URLSearchParams(location.search).get('token');

if (!resetToken) {
  // Someone opened the page without a link from an email.
  $('#reset-form').hidden = true;
  $('#reset-invalid').hidden = false;
}

onSubmit($('#reset-form'), async function () {
  const form = readForm($('#reset-form'));

  if (form.password !== form.confirm) {
    throw new Error('The two passwords do not match.'); // shown as a red message
  }

  await api('/auth/reset-password', {
    method: 'POST',
    body: { token: resetToken, password: form.password },
  });

  $('#reset-form').hidden = true;
  $('#reset-done').hidden = false;
});
