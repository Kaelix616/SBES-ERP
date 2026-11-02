// sbes.erp – Students routes
// Registration with RFID uniqueness guards, listing, deletion

const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getAuth, getDb, admin } = require('../config/firebase');
const { todayIST, norm } = require('../utils/helpers');

const db = () => getDb();

router.use(authenticate);

/**
 * GET /api/students
 * Staff: list students, optionally filtered by ?classId=xxx
 * Student: can only see their own record
 */
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      // Students can only see their own record
      const sid = req.user.studentId || req.user.uid;
      const doc = await db().collection('students').doc(sid).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Student record not found.' });
      }
      return res.json({ students: [{ id: doc.id, ...doc.data() }] });
    }

    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    let ref = db().collection('students');
    if (req.query.classId) {
      ref = ref.where('classId', '==', req.query.classId);
    }
    const snap = await ref.get();
    const students = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
    res.json({ students });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/students/:id
 * Staff can read any student; student can read self only.
 */
router.get('/:id',
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Students can only read their own record
      if (req.user.role === 'student' && id !== req.user.uid && id !== req.user.studentId) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      if (!['admin', 'teacher', 'student'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const doc = await db().collection('students').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/students
 * Register a new student with RFID card.
 * Staff only. Performs duplicate checks and creates Auth + Firestore records atomically.
 * Body: { classId, name, rollNo, rfid, password }
 */
router.post('/',
  authorize('admin', 'teacher'),
  body('classId').notEmpty().withMessage('Class ID is required.'),
  body('name').trim().notEmpty().withMessage('Student name is required.'),
  body('rollNo').trim().notEmpty().withMessage('Roll number is required.'),
  body('rfid').trim().notEmpty().withMessage('RFID card UID is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  validate,
  async (req, res, next) => {
    let createdAuthUser = null;
    try {
      const { classId, name, rollNo, password } = req.body;
      const rfid = req.body.rfid.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
      const rollKey = `${classId}_${norm(rollNo)}`;

      // Verify the class exists
      const classDoc = await db().collection('classes').doc(classId).get();
      if (!classDoc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }

      // ── Duplicate protection (friendly pre-check) ───────────────────
      const [rfidDoc, rollDoc] = await Promise.all([
        db().collection('rfidIndex').doc(rfid).get(),
        db().collection('rollIndex').doc(rollKey).get(),
      ]);

      if (rfidDoc.exists) {
        const d = rfidDoc.data();
        return res.status(409).json({
          error: `RFID UID ${rfid} is already assigned to ${d.name} (Roll ${d.rollNo}). Use a different card.`,
        });
      }

      if (rollDoc.exists) {
        const d = rollDoc.data();
        return res.status(409).json({
          error: `Roll number ${rollNo} is already registered in this class (${d.name}).`,
        });
      }

      // ── Create Firebase Auth user ───────────────────────────────────
      const email = `${norm(classId)}-${norm(rollNo)}@students.sbes.erp`;
      const userRecord = await getAuth().createUser({
        email,
        password,
        displayName: name.trim(),
      });
      createdAuthUser = userRecord;

      const uid = userRecord.uid;
      const joinDate = todayIST();

      // ── Atomic batch write: student + user + rfidIndex + rollIndex ──
      const batch = db().batch();

      batch.set(db().collection('students').doc(uid), {
        uid,
        name: name.trim(),
        rollNo: rollNo.trim(),
        rfid,
        classId,
        email,
        joinDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      batch.set(db().collection('users').doc(uid), {
        role: 'student',
        name: name.trim(),
        email,
        classId,
        studentId: uid,
      });

      batch.set(db().collection('rfidIndex').doc(rfid), {
        studentId: uid,
        name: name.trim(),
        rollNo: rollNo.trim(),
        classId,
      });

      batch.set(db().collection('rollIndex').doc(rollKey), {
        studentId: uid,
        name: name.trim(),
      });

      await batch.commit();

      res.status(201).json({
        message: `Student ${name} has been successfully registered in sbes.erp.`,
        student: {
          uid,
          name: name.trim(),
          rollNo: rollNo.trim(),
          rfid,
          classId,
          email,
          password, // returned once so staff can give it to the student
          joinDate,
          className: classDoc.data().name,
        },
      });
    } catch (err) {
      // Roll back the Auth user if the batch failed
      if (createdAuthUser) {
        try {
          await getAuth().deleteUser(createdAuthUser.uid);
        } catch (_) { /* ignore cleanup errors */ }
      }

      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({
          error: 'A login with this email already exists. The roll number may already be registered.',
        });
      }

      next(err);
    }
  }
);

/**
 * DELETE /api/students/:id
 * Delete a student and all their index documents. Admin only.
 * Also deletes the Firebase Auth account.
 */
router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const doc = await db().collection('students').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const student = doc.data();
      const rollKey = `${student.classId}_${norm(student.rollNo)}`;

      // Delete Auth user
      try {
        await getAuth().deleteUser(id);
      } catch (e) {
        // Auth user might already be deleted manually
        if (e.code !== 'auth/user-not-found') throw e;
      }

      // Batch delete all related documents
      const batch = db().batch();
      batch.delete(db().collection('students').doc(id));
      batch.delete(db().collection('users').doc(id));
      batch.delete(db().collection('rfidIndex').doc(student.rfid));
      batch.delete(db().collection('rollIndex').doc(rollKey));
      await batch.commit();

      res.json({
        message: `Student ${student.name} has been removed from sbes.erp.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
