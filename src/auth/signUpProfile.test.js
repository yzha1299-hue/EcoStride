import { describe, expect, it } from 'vitest'
import { signUpProfileFields } from './signUpProfile'

// What gets stored for a new account depends on the role the person picked.
// Club member is never granted at sign-up: it becomes a pending request.
describe('signUpProfileFields', () => {
  it('stores a participant as a participant, with no request', () => {
    expect(signUpProfileFields('participant')).toEqual({ role: 'participant' })
  })

  it('stores a club member choice as a participant with a pending request', () => {
    expect(signUpProfileFields('clubMember')).toEqual({ role: 'participant', clubRequest: 'pending' })
  })

  it.each(['admin', '', undefined, null, 'superuser'])('never grants more than participant for %j', (choice) => {
    expect(signUpProfileFields(choice)).toEqual({ role: 'participant' })
  })
})
