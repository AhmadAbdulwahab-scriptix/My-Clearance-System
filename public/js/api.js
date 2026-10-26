// api.js - everything about talking to the backend and the logged-in user.

// On your own computer the backend runs on port 5000. Anywhere else (the live
// website) the pages talk to the deployed backend.
const API_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://my-clearance-system.onrender.com/api';


// The logged-in user is saved in the browser (localStorage) at login.
function getUser() {
  const text = localStorage.getItem('user');
  if (text === null) {
    return null;
  }
  return JSON.parse(text);
}

const currentUser = getUser();


function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}


function logout() {
  localStorage.clear();
  location.href = 'index.html';
}


// Every backend call goes through this function.
// - adds the login token to the request
// - returns the "data" part of the response
// - throws an Error with a readable message if something went wrong
async function api(path, options) {
  options = options || {};

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  let body = undefined;
  if (options.body) {
    body = JSON.stringify(options.body);
  }

  // Step 1: send the request
  // Free hosting puts the server to sleep when nobody uses it, so the first
  // request can take up to a minute. Tell the user instead of leaving them guessing.
  const wakeTimer = setTimeout(function () {
    if (typeof showToast === 'function') {
      showToast('Waking up the server... the first request can take up to a minute.');
    }
  }, 7000);

  let response;
  try {
    response = await fetch(API_URL + path, {
      method: options.method || 'GET',
      headers: headers,
      body: body,
    });
  } catch (error) {
    throw new Error('Cannot reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(wakeTimer);
  }

  // Step 2: read the JSON the server sent back
  let result = {};
  try {
    result = await response.json();
  } catch (error) {
    // the response had no JSON body, keep the empty object
  }

  // Step 3: a 401 means the token is missing or expired, so sign in again
  const isAuthRoute = path.indexOf('/auth/') === 0;
  if (response.status === 401 && token && !isAuthRoute) {
    logout();
  }

  // Step 4: turn error responses into a thrown Error
  if (!response.ok) {
    let message = result.message || 'Request failed';
    if (Array.isArray(result.details) && result.details.length > 0) {
      message = result.details.join(', ');
    }
    const error = new Error(message);
    error.status = response.status; // lets a page tell "not found" (404) from other problems
    throw error;
  }

  return result.data;
}
