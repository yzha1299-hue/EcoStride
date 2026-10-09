// Every failure the API reports has the same shape: an HTTP status, a stable
// machine-readable code the front end can branch on, and a human message.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const unauthenticated = (message = 'Sign in to continue.') =>
  new ApiError(401, 'UNAUTHENTICATED', message)

export const invalidRequest = (message) => new ApiError(400, 'INVALID_REQUEST', message)

export const notFound = (message = 'Not found.') => new ApiError(404, 'NOT_FOUND', message)

export const notOwner = (message = "Only the club member who created this event can do that.") =>
  new ApiError(403, 'NOT_OWNER', message)

export const emailNotVerified = () =>
  new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before using email features.')
