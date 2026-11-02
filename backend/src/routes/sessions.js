// sbes.erp – Sessions routes
// Start/end attendance sessions, list sessions

const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getDb, admin } = require('../config/firebase');
const { todayIST } = require('../utils/helpers');

const db = () => getDb();

router.use(authenticate);

/**
 * GET /api/sessions
 * List sessions. Optional query params: ?classId=xxx&status=open|closed
 * Staff: can see all. Student: can see sessions of their own class.
 */
router.get('/', async (req, res, next) => {
  try {
    let ref = db().collection('sessions');

    if (req.user.role === 'student') {
      // Students can only see their own class sessions
      if (!req.user.classId) {
        return res.status(403).json({ error: 'No class assigned to your account.' });
      }
      ref = ref.where('classId', '==', req.user.classId);
    } else if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (req.query.classId && req.user.role !== 'student') {
      ref = ref.where('classId', '==', req.query.classId);
    }
    if (req.query.status) {
      ref = ref.where('status', '==', req.query.status);
    }

    const snap = await ref.get();
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:id
 */
router.get('/:id',
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const doc = await db().collection('sessions').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      // Student access check
      if (req.user.role === 'student' && doc.data().classId !== req.user.classId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/sessions/start
 * Start a new attendance session.
 * Staff only.
 * Body: { classId, subjectId }
 */
router.post('/start',
  authorize('admin', 'teacher'),
  body('classId').notEmpty().withMessage('Class ID is required.'),
  body('subjectId').notEmpty().withMessage('Subject ID is required.'),
  validate,
  async (req, res, next) => {
    try {
      const { classId, subjectId } = req.body;

      // Verify class exists and has no active session
      const classDoc = await db().collection('classes').doc(classId).get();
      if (!classDoc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }
      if (classDoc.data().activeSessionId) {
        return res.status(409).json({
          error: 'This class already has an active session. End it first.',
          activeSessionId: classDoc.data().activeSessionId,
        });
      }

      // Verify subject exists and belongs to this class
      const subjectDoc = await db().collection('subjects').doc(subjectId).get();
      if (!subjectDoc.exists) {
        return res.status(404).json({ error: 'Subject not found.' });
      }
      if (subjectDoc.data().classId !== classId) {
        return res.status(400).json({ error: 'This subject does not belong to the selected class.' });
      }

      const subjectName = subjectDoc.data().name;
      const date = todayIST();

      // Create session document
      const sessionRef = await db().collection('sessions').add({
        classId,
        subjectId,
        subjectName,
        date,
        status: 'open',
        startedBy: req.user.uid,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update class active fields (reader uses these)
      await db().collection('classes').doc(classId).update({
        activeSessionId: sessionRef.id,
        activeSubjectId: subjectId,
        activeSubjectName: subjectName,
        activeDate: date,
      });

      res.status(201).json({
        message: `Session started: ${subjectName} (${date}).`,
        session: {
          id: sessionRef.id,
          classId,
          subjectId,
          subjectName,
          date,
          status: 'open',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/sessions/:id/end
 * End an active session.
 * Staff only.
 */
router.post('/:id/end',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const sessionRef = db().collection('sessions').doc(req.params.id);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      const session = sessionDoc.data();
      if (session.status === 'closed') {
        return res.status(400).json({ error: 'This session is already closed.' });
      }

      // Close the session
      await sessionRef.update({
        status: 'closed',
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        endedBy: req.user.uid,
      });

      // Clear the class active fields
      await db().collection('classes').doc(session.classId).update({
        activeSessionId: '',
        activeSubjectId: '',
        activeSubjectName: '',
        activeDate: '',
      });

      // Count attendance for this session
      const attSnap = await db().collection('attendance')
        .where('sessionId', '==', req.params.id).get();

      res.json({
        message: 'Session ended and saved.',
        session: {
          id: req.params.id,
          ...session,
          status: 'closed',
        },
        presentCount: attSnap.size,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/sessions/:id
 * Delete a session. Admin only.
 */
router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const sessionRef = db().collection('sessions').doc(req.params.id);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      // If session is active, clear class fields
      const session = sessionDoc.data();
      if (session.status === 'open') {
        await db().collection('classes').doc(session.classId).update({
          activeSessionId: '',
          activeSubjectId: '',
          activeSubjectName: '',
          activeDate: '',
        });
      }

      await sessionRef.delete();
      res.json({ message: 'Session deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
