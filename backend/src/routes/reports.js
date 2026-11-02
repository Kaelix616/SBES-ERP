// sbes.erp – Reports routes
// Attendance percentage calculations (mirrors the frontend calc() logic)

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const { pct } = require('../utils/helpers');

const db = () => getDb();

const MIN_PERCENT = parseInt(process.env.MIN_PERCENT) || 75;

router.use(authenticate);

/**
 * GET /api/reports/class/:classId
 * Full attendance report for a class.
 * Returns per-student, per-subject attendance with percentages.
 * Staff only.
 */
router.get('/class/:classId',
  authorize('admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { classId } = req.params;

      // Fetch all data in parallel
      const [sessionsSnap, studentsSnap, attendanceSnap, subjectsSnap] = await Promise.all([
        db().collection('sessions').where('classId', '==', classId).get(),
        db().collection('students').where('classId', '==', classId).get(),
        db().collection('attendance').where('classId', '==', classId).get(),
        db().collection('subjects').where('classId', '==', classId).get(),
      ]);

      const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const students = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
      const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Build per-subject session counts
      const subjectSessionCounts = {};
      sessions.forEach(s => {
        if (s.status === 'closed') {
          subjectSessionCounts[s.subjectId] = (subjectSessionCounts[s.subjectId] || 0) + 1;
        }
      });

      // Calculate attendance for each student
      const report = students.map(student => {
        const studentAtt = attendance.filter(a => a.studentId === student.id);
        const presentSessionIds = new Set(studentAtt.map(a => a.sessionId));

        const perSubject = {};
        let totalPresent = 0;
        let totalHeld = 0;

        sessions.forEach(s => {
          if (s.status !== 'closed') return;
          if (s.date < (student.joinDate || '0000')) return;

          if (!perSubject[s.subjectId]) {
            perSubject[s.subjectId] = { total: 0, present: 0 };
          }
          perSubject[s.subjectId].total++;
          totalHeld++;

          if (presentSessionIds.has(s.id)) {
            perSubject[s.subjectId].present++;
            totalPresent++;
          }
        });

        const overall = pct(totalPresent, totalHeld);
        const shortage = overall < MIN_PERCENT && totalHeld > 0;

        // Skip/recover calculations
        const canSkip = Math.max(0, Math.floor((4 * totalPresent) / 3 - totalHeld));
        const needToRecover = Math.max(0, 3 * totalHeld - 4 * totalPresent);

        return {
          student: {
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            joinDate: student.joinDate,
          },
          subjects: Object.entries(perSubject).map(([subjectId, data]) => {
            const subject = subjects.find(s => s.id === subjectId);
            return {
              subjectId,
              subjectName: subject?.name || 'Unknown',
              present: data.present,
              total: data.total,
              percentage: pct(data.present, data.total),
              shortage: pct(data.present, data.total) < MIN_PERCENT && data.total > 0,
            };
          }),
          overall: {
            present: totalPresent,
            total: totalHeld,
            percentage: overall,
            shortage,
            canSkip,
            needToRecover,
          },
        };
      });

      // Summary stats
      const totalStudents = students.length;
      const totalClosedSessions = sessions.filter(s => s.status === 'closed').length;
      const shortageCount = report.filter(r => r.overall.shortage).length;

      res.json({
        classId,
        minPercent: MIN_PERCENT,
        summary: {
          totalStudents,
          totalClosedSessions,
          shortageCount,
          subjects: subjects.map(s => ({
            id: s.id,
            name: s.name,
            code: s.code,
            sessionsHeld: subjectSessionCounts[s.id] || 0,
          })),
        },
        report,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/reports/student/:studentId
 * Individual student attendance report.
 * Staff: can access any student.
 * Student: can access only their own.
 */
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Access control
    if (req.user.role === 'student') {
      const sid = req.user.studentId || req.user.uid;
      if (studentId !== sid) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } else if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch student
    const studentDoc = await db().collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = { id: studentDoc.id, ...studentDoc.data() };

    // Fetch related data
    const [sessionsSnap, attendanceSnap, subjectsSnap, classDoc] = await Promise.all([
      db().collection('sessions').where('classId', '==', student.classId).get(),
      db().collection('attendance').where('studentId', '==', studentId).get(),
      db().collection('subjects').where('classId', '==', student.classId).get(),
      db().collection('classes').doc(student.classId).get(),
    ]);

    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const presentSessionIds = new Set(attendance.map(a => a.sessionId));

    const perSubject = {};
    let totalPresent = 0;
    let totalHeld = 0;

    sessions.forEach(s => {
      if (s.status !== 'closed') return;
      if (s.date < (student.joinDate || '0000')) return;

      if (!perSubject[s.subjectId]) {
        perSubject[s.subjectId] = { total: 0, present: 0 };
      }
      perSubject[s.subjectId].total++;
      totalHeld++;

      if (presentSessionIds.has(s.id)) {
        perSubject[s.subjectId].present++;
        totalPresent++;
      }
    });

    const overall = pct(totalPresent, totalHeld);
    const canSkip = Math.max(0, Math.floor((4 * totalPresent) / 3 - totalHeld));
    const needToRecover = Math.max(0, 3 * totalHeld - 4 * totalPresent);

    let note;
    if (!totalHeld) {
      note = 'No classes have been held yet.';
    } else if (overall >= MIN_PERCENT) {
      note = `You can miss up to ${canSkip} more class${canSkip === 1 ? '' : 'es'} and stay at ${MIN_PERCENT}%.`;
    } else {
      note = `Attend the next ${needToRecover} class${needToRecover === 1 ? '' : 'es'} in a row to reach ${MIN_PERCENT}%.`;
    }

    res.json({
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        classId: student.classId,
        className: classDoc.exists ? classDoc.data().name : 'Unknown',
        joinDate: student.joinDate,
      },
      overall: {
        present: totalPresent,
        total: totalHeld,
        percentage: overall,
        shortage: overall < MIN_PERCENT && totalHeld > 0,
        canSkip,
        needToRecover,
        note,
      },
      subjects: Object.entries(perSubject).map(([subjectId, data]) => {
        const subject = subjects.find(s => s.id === subjectId);
        return {
          subjectId,
          subjectName: subject?.name || 'Unknown',
          present: data.present,
          total: data.total,
          percentage: pct(data.present, data.total),
          shortage: pct(data.present, data.total) < MIN_PERCENT && data.total > 0,
        };
      }),
      minPercent: MIN_PERCENT,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/session/:sessionId
 * Attendance summary for a specific session.
 * Staff only.
 */
router.get('/session/:sessionId',
  authorize('admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      const sessionDoc = await db().collection('sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        return res.status(404).json({ error: 'Session not found.' });
      }
      const session = { id: sessionDoc.id, ...sessionDoc.data() };

      // Get all students in the class and attendance for this session
      const [studentsSnap, attendanceSnap] = await Promise.all([
        db().collection('students').where('classId', '==', session.classId).get(),
        db().collection('attendance').where('sessionId', '==', sessionId).get(),
      ]);

      const students = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
      const presentMap = new Map(
        attendanceSnap.docs.map(d => [d.data().studentId, { id: d.id, ...d.data() }])
      );

      const roster = students.map(s => ({
        studentId: s.id,
        name: s.name,
        rollNo: s.rollNo,
        status: presentMap.has(s.id) ? 'present' : 'absent',
        time: presentMap.get(s.id)?.time || null,
        source: presentMap.get(s.id)?.source || null,
      }));

      res.json({
        session,
        totalStudents: students.length,
        presentCount: presentMap.size,
        absentCount: students.length - presentMap.size,
        roster,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/reports/defaulters/:classId
 * List of defaulter students (< MIN_PERCENT) for a specific class.
 * Staff only.
 */
router.get('/defaulters/:classId',
  authorize('admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { classId } = req.params;

      const [sessionsSnap, studentsSnap, attendanceSnap] = await Promise.all([
        db().collection('sessions').where('classId', '==', classId).get(),
        db().collection('students').where('classId', '==', classId).get(),
        db().collection('attendance').where('classId', '==', classId).get(),
      ]);

      const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const students = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
      const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const closedSessions = sessions.filter(s => s.status === 'closed');
      const totalHeld = closedSessions.length;

      const defaulters = [];

      students.forEach(student => {
        const studentAtt = attendance.filter(a => a.studentId === student.id && a.status === 'present');
        const presentSessionIds = new Set(studentAtt.map(a => a.sessionId));

        let totalPresent = 0;
        closedSessions.forEach(s => {
          if (presentSessionIds.has(s.id)) totalPresent++;
        });

        const overall = pct(totalPresent, totalHeld);
        if (overall < MIN_PERCENT && totalHeld > 0) {
          const needToRecover = Math.max(0, 3 * totalHeld - 4 * totalPresent);
          defaulters.push({
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            present: totalPresent,
            total: totalHeld,
            percentage: overall,
            needToRecover,
          });
        }
      });

      res.json({
        threshold: MIN_PERCENT,
        defaulters,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
