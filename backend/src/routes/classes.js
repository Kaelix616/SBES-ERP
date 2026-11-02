// sbes.erp – Classes routes
// CRUD for classroom management

const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getDb, admin } = require('../config/firebase');

const db = () => getDb();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/classes
 * List all classes. Any signed-in user can read.
 */
router.get('/', async (req, res, next) => {
  try {
    const snap = await db().collection('classes').get();
    const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ classes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/classes/:id
 * Get a single class by ID
 */
router.get('/:id',
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const doc = await db().collection('classes').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/classes
 * Create a new class. Admin only.
 * Body: { name }
 */
router.post('/',
  authorize('admin'),
  body('name').trim().notEmpty().withMessage('Class name is required.'),
  validate,
  async (req, res, next) => {
    try {
      const ref = await db().collection('classes').add({
        name: req.body.name.trim(),
        activeSessionId: '',
        activeSubjectId: '',
        activeSubjectName: '',
        activeDate: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const created = await ref.get();
      res.status(201).json({
        message: `Class "${req.body.name}" created.`,
        class: { id: ref.id, ...created.data() },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/classes/:id
 * Update a class.
 * Admin: can update anything.
 * Teacher: can only update active session fields.
 */
router.patch('/:id',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const docRef = db().collection('classes').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }

      const allowedTeacherFields = ['activeSessionId', 'activeSubjectId', 'activeSubjectName', 'activeDate'];
      const updates = {};

      if (req.user.role === 'teacher') {
        // Teachers can only update active session fields
        for (const key of Object.keys(req.body)) {
          if (!allowedTeacherFields.includes(key)) {
            return res.status(403).json({
              error: `Teachers cannot update the "${key}" field. Only session fields are allowed.`,
            });
          }
          updates[key] = req.body[key];
        }
      } else {
        // Admin can update anything
        Object.assign(updates, req.body);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      await docRef.update(updates);
      const updated = await docRef.get();
      res.json({
        message: 'Class updated.',
        class: { id: updated.id, ...updated.data() },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/classes/:id
 * Delete a class. Admin only.
 */
router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const docRef = db().collection('classes').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }
      await docRef.delete();
      res.json({ message: `Class "${doc.data().name}" deleted.` });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
