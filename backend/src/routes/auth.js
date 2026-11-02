// sbes.erp – Auth routes
// POST /api/auth/login        – Sign in (returns Firebase custom token)
// POST /api/auth/me           – Get current user profile
// POST /api/auth/reset-password – Send password reset email

const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { getAuth, getDb, admin } = require('../config/firebase');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * 
 * Firebase Admin SDK cannot sign in with email/password directly.
 * This endpoint uses the Firebase Auth REST API to verify credentials,
 * then returns the ID token to the client.
 */
router.post('/login',
  body('email').isEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const apiKey = process.env.FIREBASE_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'FIREBASE_API_KEY not configured on the server.' });
      }

      // Use Firebase Auth REST API to sign in
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const code = data?.error?.message || '';
        if (code.includes('EMAIL_NOT_FOUND') || code.includes('INVALID_PASSWORD') || code.includes('INVALID_LOGIN_CREDENTIALS')) {
          return res.status(401).json({ error: 'Email or password is incorrect.' });
        }
        if (code.includes('TOO_MANY_ATTEMPTS')) {
          return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
        }
        if (code.includes('USER_DISABLED')) {
          return res.status(403).json({ error: 'This account has been disabled.' });
        }
        return res.status(401).json({ error: 'Authentication failed.' });
      }

      // Fetch the user's role from Firestore
      const userDoc = await getDb().collection('users').doc(data.localId).get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: 'This account has no portal role. Contact the administrator.' });
      }

      const userData = userDoc.data();
      if (!['admin', 'teacher', 'student', 'device'].includes(userData.role)) {
        return res.status(403).json({ error: 'Unknown role. Contact the administrator.' });
      }

      res.json({
        message: 'Signed in successfully.',
        idToken: data.idToken,
        token: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        user: {
          uid: data.localId,
          email: data.email,
          role: userData.role,
          name: userData.name,
          classId: userData.classId || null,
          studentId: userData.studentId || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userDoc = await getDb().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found.' });
    }
    res.json({
      uid: req.user.uid,
      ...userDoc.data(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { email }
 * Generates a password reset link using Admin SDK
 */
router.post('/reset-password',
  body('email').isEmail().withMessage('Valid email is required.'),
  validate,
  async (req, res, next) => {
    try {
      const link = await getAuth().generatePasswordResetLink(req.body.email);
      // In production, you'd send this via email. For now, return success.
      res.json({
        message: 'Password reset link generated.',
        // Only include link in dev mode for testing
        ...(process.env.NODE_ENV !== 'production' && { resetLink: link }),
      });
    } catch (err) {
      // Don't reveal whether the email exists
      if (err.code === 'auth/user-not-found') {
        return res.json({ message: 'If the email is registered, a reset link has been sent.' });
      }
      next(err);
    }
  }
);

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Exchanges a refresh token for a new ID token via Firebase REST API
 */
router.post('/refresh',
  body('refreshToken').notEmpty().withMessage('Refresh token is required.'),
  validate,
  async (req, res, next) => {
    try {
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'FIREBASE_API_KEY not configured on the server.' });
      }

      const response = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${req.body.refreshToken}`,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return res.status(401).json({ error: 'Failed to refresh token. Please sign in again.' });
      }

      res.json({
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
