// What to store for a new account, from the role the person picked. Club member
// is never granted at sign-up: the account starts as a participant with a
// pending request that an admin approves later (see firestore.rules).
export function signUpProfileFields(chosenRole) {
  return chosenRole === 'clubMember' ? { role: 'participant', clubRequest: 'pending' } : { role: 'participant' }
}
