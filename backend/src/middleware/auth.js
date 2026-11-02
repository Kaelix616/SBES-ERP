// sbes.erp – Authentication middleware
// Verifies Firebase ID tokens and attaches user role from Firestore

const { getAuth, getDb } = require('../config/firebase');

/**
 * Middleware: verifies the Firebase ID token in the Authorization header
 * and attaches the decoded user + their Firestore role to req.user
 *
 * Sets: req.user = { uid, email, role, name, classId?, studentId? }
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <idToken>' });
  }

  const idToken = header.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);

    // Fetch the user's role from Firestore users collection
    const userDoc = await getDb().collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'No portal role found for this account. Contact the administrator.' });
    }

    const userData = userDoc.data();
    if (!['admin', 'teacher', 'student', 'device'].includes(userData.role)) {
      return res.status(403).json({ error: 'Unknown role. Contact the administrator.' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email || userData.email,
      role: userData.role,
      name: userData.name,
      classId: userData.classId || null,
      studentId: userData.studentId || null,
    };

    next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

/**
 * Factory: returns middleware that only allows specific roles.
 * Usage: authorize('admin', 'teacher')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
