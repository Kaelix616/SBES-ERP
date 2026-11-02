// sbes.erp – Teachers routes
// Create and list teacher accounts (admin only)

const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getAuth, getDb, admin } = require('../config/firebase');

const db = () => getDb();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/teachers
 * List all teachers.
 */
router.get('/', async (req, res, next) => {
  try {
    const snap = await db().collection('users').where('role', '==', 'teacher').get();
    const teachers = snap.docs.map(d => ({
      uid: d.id,
      ...d.data(),
    }));
    res.json({ teachers });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/teachers
 * Create a teacher login.
 * Body: { name, email, password }
 */
router.post('/',
  body('name').trim().notEmpty().withMessage('Teacher name is required.'),
  body('email').isEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      // Create Firebase Auth user
      const userRecord = await getAuth().createUser({
        email,
        password,
        displayName: name,
      });

      // Create Firestore user document with teacher role
      await db().collection('users').doc(userRecord.uid).set({
        role: 'teacher',
        name: name.trim(),
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(201).json({
        message: `Teacher ${name} has been successfully registered in sbes.erp.`,
        teacher: {
          uid: userRecord.uid,
          name: name.trim(),
          email,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/teachers/:uid
 * Delete a teacher account.
 */
router.delete('/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;

    // Verify the user is actually a teacher
    const userDoc = await db().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'teacher') {
      return res.status(404).json({ error: 'Teacher not found.' });
    }

    // Delete Auth user and Firestore document
    await getAuth().deleteUser(uid);
    await db().collection('users').doc(uid).delete();

    res.json({ message: `Teacher "${userDoc.data().name}" has been removed.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
