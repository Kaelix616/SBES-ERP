// sbes.erp – Attendance routes
// Mark present (manual + RFID device), mark absent, list attendance

const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getDb, admin } = require('../config/firebase');
const { todayIST, nowISTTime } = require('../utils/helpers');

const db = () => getDb();

router.use(authenticate);

/**
 * GET /api/attendance
 * Query attendance records.
 * Required: ?sessionId=xxx  OR  ?classId=xxx  OR  ?studentId=xxx
 * Staff: can see all. Student: can see only their own.
 */
router.get('/', async (req, res, next) => {
  try {
    let ref = db().collection('attendance');
    const { sessionId, classId, studentId } = req.query;

    if (req.user.role === 'student') {
      // Students can only see their own attendance
      const sid = req.user.studentId || req.user.uid;
      ref = ref.where('studentId', '==', sid);
    } else if (!['admin', 'teacher'].includes(req.user.role) && req.user.role !== 'device') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (sessionId) ref = ref.where('sessionId', '==', sessionId);
    if (classId && req.user.role !== 'student') ref = ref.where('classId', '==', classId);
    if (studentId && req.user.role !== 'student') ref = ref.where('studentId', '==', studentId);

    if (!sessionId && !classId && !studentId && req.user.role !== 'student') {
      return res.status(400).json({
        error: 'Please provide at least one filter: sessionId, classId, or studentId.',
      });
    }

    const snap = await ref.get();
    const attendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ attendance });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/mark
 * Mark a student present (manual by staff).
 * Body: { sessionId, studentId }
 */
router.post('/mark',
  authorize('admin', 'teacher'),
  body('sessionId').notEmpty().withMessage('Session ID is required.'),
  body('studentId').notEmpty().withMessage('Student ID is required.'),
  validate,
  async (req, res, next) => {
    try {
      const { sessionId, studentId } = req.body;
      const attId = `${sessionId}_${studentId}`;

      // Check if already marked
      const existing = await db().collection('attendance').doc(attId).get();
      if (existing.exists) {
        return res.status(409).json({ error: 'Student already marked present for this session.' });
      }

      // Verify session exists and is open
      const sessionDoc = await db().collection('sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        return res.status(404).json({ error: 'Session not found.' });
      }
      if (sessionDoc.data().status !== 'open') {
        return res.status(400).json({ error: 'This session is closed. Cannot mark attendance.' });
      }

      // Get student info
      const studentDoc = await db().collection('students').doc(studentId).get();
      if (!studentDoc.exists) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const student = studentDoc.data();
      const session = sessionDoc.data();

      await db().collection('attendance').doc(attId).set({
        sessionId,
        classId: session.classId,
        subjectId: session.subjectId,
        studentId,
        name: student.name,
        rollNo: student.rollNo,
        date: session.date || todayIST(),
        time: nowISTTime(),
        status: 'present',
        source: 'manual',
        markedBy: req.user.uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(201).json({
        message: `${student.name} marked present.`,
        attendance: { id: attId, studentId, name: student.name, rollNo: student.rollNo },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/attendance/rfid
 * Mark attendance from an RFID card scan (used by the ESP32 device).
 * Body: { rfidUid, classId }
 * Device role only.
 */
router.post('/rfid',
  authorize('device'),
  body('rfidUid').notEmpty().withMessage('RFID UID is required.'),
  body('classId').notEmpty().withMessage('Class ID is required.'),
  validate,
  async (req, res, next) => {
    try {
      const rfidUid = req.body.rfidUid.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
      const { classId } = req.body;

      // Look up the student by RFID
      const rfidDoc = await db().collection('rfidIndex').doc(rfidUid).get();
      if (!rfidDoc.exists) {
        // Unknown card – save to devices for "Capture from reader" feature
        await db().collection('devices').doc(req.body.deviceId || 'esp32-01').set({
          lastUid: rfidUid,
          lastScanAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(404).json({ error: 'Unknown card.', rfidUid });
      }

      const rfidData = rfidDoc.data();

      // Verify the student belongs to this class
      if (rfidData.classId !== classId) {
        return res.status(400).json({ error: 'Student belongs to a different class.' });
      }

      // Check if there's an active session
      const classDoc = await db().collection('classes').doc(classId).get();
      if (!classDoc.exists) {
        return res.status(404).json({ error: 'Class not found.' });
      }

      const classData = classDoc.data();
      if (!classData.activeSessionId) {
        return res.status(400).json({ error: 'No active session.' });
      }

      const sessionId = classData.activeSessionId;
      const attId = `${sessionId}_${rfidData.studentId}`;

      // Check if already marked
      const existing = await db().collection('attendance').doc(attId).get();
      if (existing.exists) {
        return res.status(409).json({
          error: 'Already marked.',
          name: rfidData.name,
          rollNo: rfidData.rollNo,
        });
      }

      // Mark present
      await db().collection('attendance').doc(attId).set({
        sessionId,
        classId,
        subjectId: classData.activeSubjectId,
        studentId: rfidData.studentId,
        name: rfidData.name,
        rollNo: rfidData.rollNo,
        date: classData.activeDate || todayIST(),
        time: nowISTTime(),
        status: 'present',
        source: 'rfid',
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(201).json({
        message: `Present: ${rfidData.name} (${rfidData.rollNo}).`,
        attendance: {
          id: attId,
          studentId: rfidData.studentId,
          name: rfidData.name,
          rollNo: rfidData.rollNo,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/attendance/:id
 * Remove an attendance record (mark absent). Staff only.
 */
router.delete('/:id',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const docRef = db().collection('attendance').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }
      await docRef.delete();
      res.json({
        message: `${doc.data().name} marked absent (attendance record removed).`,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
