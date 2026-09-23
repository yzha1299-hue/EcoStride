// Firebase Auth errors carry a stable `code` but a developer-facing `message`
// (e.g. "Firebase: Error (auth/popup-blocked)."), so users see these instead.
const MESSAGES = {
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing. Please try again.',
  'auth/cancelled-popup-request': 'The Google sign-in window was closed before finishing. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'We could not reach the sign-in service. Check your connection and try again.',
  'auth/invalid-credential': 'That email and password combination is incorrect.',
  'auth/wrong-password': 'That email and password combination is incorrect.',
  'auth/user-not-found': 'That email and password combination is incorrect.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists. Sign in with your email and password instead.',
  'auth/unauthorized-domain': 'Google sign-in is not enabled for this web address.',
}

export function authErrorMessage(error) {
  return MESSAGES[error?.code] || 'Something went wrong. Please try again.'
}
