// sbes.erp – Subjects routes
// CRUD for subject management (admin only for writes)

const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getDb, admin } = require('../config/firebase');

const db = () => getDb();

router.use(authenticate);

/**
 * GET /api/subjects
 * List all subjects. Optional query param: ?classId=xxx
 */
router.get('/', async (req, res, next) => {
  try {
    let ref = db().collection('subjects');
    if (req.query.classId) {
      ref = ref.where('classId', '==', req.query.classId);
    }
    const snap = await ref.get();
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ subjects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/subjects/:id
 */
router.get('/:id',
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const doc = await db().collection('subjects').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Subject not found.' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/subjects
 * Body: { classId, name, code }
 * Admin only.
 */
router.post('/',
  authorize('admin'),
  body('classId').notEmpty().withMessage('Class ID is required.'),
  body('name').trim().notEmpty().withMessage('Subject name is required.'),
  body('code').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      // Verify the class exists
      const classDoc = await db().collection('classes').doc(req.body.classId).get();
      if (!classDoc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }

      const ref = await db().collection('subjects').add({
        classId: req.body.classId,
        name: req.body.name.trim(),
        code: (req.body.code || '').trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const created = await ref.get();
      res.status(201).json({
        message: `Subject "${req.body.name}" added.`,
        subject: { id: ref.id, ...created.data() },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/subjects/:id
 * Admin only.
 */
router.patch('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const docRef = db().collection('subjects').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Subject not found.' });
      }

      const updates = {};
      if (req.body.name) updates.name = req.body.name.trim();
      if (req.body.code !== undefined) updates.code = req.body.code.trim();
      if (req.body.classId) updates.classId = req.body.classId;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      await docRef.update(updates);
      const updated = await docRef.get();
      res.json({
        message: 'Subject updated.',
        subject: { id: updated.id, ...updated.data() },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/subjects/:id
 * Admin only.
 */
router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const docRef = db().collection('subjects').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Subject not found.' });
      }
      await docRef.delete();
      res.json({ message: `Subject "${doc.data().name}" deleted.` });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
