// sbes.erp – Global error handler middleware

function errorHandler(err, _req, res, _next) {
  console.error('Unhandled error:', err);

  // Firebase-specific error codes
  if (err.code) {
    if (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED') {
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    if (err.code === 'not-found' || err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Resource not found.' });
    }
    if (err.code === 'already-exists' || err.code === 'ALREADY_EXISTS') {
      return res.status(409).json({ error: 'Resource already exists.' });
    }
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (err.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (err.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  // Custom app errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Default
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.',
  });
}

module.exports = errorHandler;
