// sbes.erp – Seed Demo Data Script
// Creates rich, realistic sample data for testing classes, subjects, students,
// attendance sessions, percentage calculations, and defaulter reports.

require('dotenv').config();
const { initFirebase, getDb, getAuth, admin } = require('../config/firebase');
const { todayIST, nowISTTime, norm } = require('../utils/helpers');

async function seed() {
  console.log('\n  ╔════════════════════════════════════════════════════════╗');
  console.log('  ║  sbes.erp – Seeding Complete Demo Data                 ║');
  console.log('  ║  Populating classes, subjects, students & attendance   ║');
  console.log('  ╚════════════════════════════════════════════════════════╝\n');

  initFirebase();
  const db = getDb();
  const auth = getAuth();

  // 1. Create Demo Class
  console.log('  [1/5] Creating Academic Classes...');
  const classRef = db.collection('classes').doc('ty-comp-a');
  await classRef.set({
    name: 'TY Computer Engineering (Div A)',
    code: 'TY-COMP-A',
    department: 'Computer Engineering',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✔ Created class: TY Computer Engineering (Div A) (ID: ty-comp-a)');

  // 2. Create Subjects
  console.log('\n  [2/5] Creating Subjects...');
  const subjectsData = [
    { id: 'sub-dbms', name: 'Database Management Systems', code: 'CS501', classId: 'ty-comp-a' },
    { id: 'sub-os', name: 'Operating Systems', code: 'CS502', classId: 'ty-comp-a' },
    { id: 'sub-cn', name: 'Computer Networks', code: 'CS503', classId: 'ty-comp-a' },
  ];

  for (const s of subjectsData) {
    await db.collection('subjects').doc(s.id).set({
      name: s.name,
      code: s.code,
      classId: s.classId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✔ Created subject: ${s.name} (${s.code})`);
  }

  // 3. Create Sample Students
  console.log('\n  [3/5] Creating Students & RFID Mapping...');
  const studentsList = [
    { name: 'Aarav Mehta', rollNo: '01', rfid: 'E20011223344', attendRate: 0.90 },  // 90%
    { name: 'Fatima Shaikh', rollNo: '02', rfid: 'E20055667788', attendRate: 0.80 }, // 80%
    { name: 'Rahul Verma', rollNo: '03', rfid: 'E20099001122', attendRate: 0.60 },   // 60% (Defaulter)
    { name: 'Pooja Patel', rollNo: '04', rfid: 'E20033445566', attendRate: 1.00 },   // 100%
    { name: 'Zaid Khan', rollNo: '05', rfid: 'E20077889900', attendRate: 0.40 },     // 40% (Defaulter)
  ];

  const studentDocs = [];
  for (const s of studentsList) {
    const studentUid = `demo_std_${s.rollNo}`;
    const email = `ty-comp-a-${s.rollNo}@students.sbes.erp`;
    const rollKey = `ty-comp-a_${norm(s.rollNo)}`;

    // Try creating Auth account for student (or reuse if already exists)
    try {
      await auth.createUser({
        uid: studentUid,
        email: email,
        password: 'student123',
        displayName: s.name,
      });
    } catch (e) {
      // User might already exist in Auth
    }

    const batch = db.batch();
    batch.set(db.collection('students').doc(studentUid), {
      uid: studentUid,
      name: s.name,
      rollNo: s.rollNo,
      rfid: s.rfid,
      classId: 'ty-comp-a',
      email: email,
      joinDate: '2026-08-01',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(db.collection('users').doc(studentUid), {
      role: 'student',
      name: s.name,
      email: email,
      classId: 'ty-comp-a',
      studentId: studentUid,
    });

    batch.set(db.collection('rfidIndex').doc(s.rfid), {
      studentId: studentUid,
      name: s.name,
      rollNo: s.rollNo,
      classId: 'ty-comp-a',
    });

    batch.set(db.collection('rollIndex').doc(rollKey), {
      studentId: studentUid,
      name: s.name,
    });

    await batch.commit();
    studentDocs.push({ id: studentUid, ...s });
    console.log(`  ✔ Registered student: Roll ${s.rollNo} - ${s.name} (RFID: ${s.rfid})`);
  }

  // 4. Create Closed Attendance Sessions & Punch Records
  console.log('\n  [4/5] Creating Past Sessions and Attendance Records...');
  const sessions = [
    { id: 'sess-01', subjectId: 'sub-dbms', date: '2026-10-15', time: '10:00 AM' },
    { id: 'sess-02', subjectId: 'sub-dbms', date: '2026-10-17', time: '10:00 AM' },
    { id: 'sess-03', subjectId: 'sub-dbms', date: '2026-10-22', time: '10:00 AM' },
    { id: 'sess-04', subjectId: 'sub-dbms', date: '2026-10-24', time: '10:00 AM' },
    { id: 'sess-05', subjectId: 'sub-os',   date: '2026-10-16', time: '11:15 AM' },
    { id: 'sess-06', subjectId: 'sub-os',   date: '2026-10-18', time: '11:15 AM' },
    { id: 'sess-07', subjectId: 'sub-os',   date: '2026-10-23', time: '11:15 AM' },
    { id: 'sess-08', subjectId: 'sub-cn',   date: '2026-10-19', time: '02:00 PM' },
    { id: 'sess-09', subjectId: 'sub-cn',   date: '2026-10-21', time: '02:00 PM' },
    { id: 'sess-10', subjectId: 'sub-cn',   date: '2026-10-26', time: '02:00 PM' },
  ];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    await db.collection('sessions').doc(s.id).set({
      classId: 'ty-comp-a',
      subjectId: s.subjectId,
      date: s.date,
      time: s.time,
      status: 'closed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark attendance based on each student's attendance target
    const attBatch = db.batch();
    for (const student of studentDocs) {
      // Deterministic attendance assignment according to student attendRate
      // Pooja (1.0) attends all 10
      // Aarav (0.9) attends 9 (skips sess-03)
      // Fatima (0.8) attends 8 (skips sess-02, sess-07)
      // Rahul (0.6) attends 6 (skips sess-01, sess-04, sess-06, sess-09)
      // Zaid (0.4) attends 4 (attends sess-01, sess-05, sess-08, sess-10)
      let isPresent = false;
      if (student.attendRate === 1.0) isPresent = true;
      else if (student.attendRate === 0.9) isPresent = (i !== 2);
      else if (student.attendRate === 0.8) isPresent = (i !== 1 && i !== 6);
      else if (student.attendRate === 0.6) isPresent = ![0, 3, 5, 8].includes(i);
      else if (student.attendRate === 0.4) isPresent = [0, 4, 7, 9].includes(i);

      if (isPresent) {
        const attId = `${s.id}_${student.id}`;
        attBatch.set(db.collection('attendance').doc(attId), {
          sessionId: s.id,
          classId: 'ty-comp-a',
          subjectId: s.subjectId,
          studentId: student.id,
          name: student.name,
          rollNo: student.rollNo,
          date: s.date,
          time: s.time,
          status: 'present',
          markedBy: 'rfid',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    await attBatch.commit();
  }
  console.log(`  ✔ Created 10 closed sessions and attendance punch records across 3 subjects.`);

  // 5. Create 1 Active Open Session for Live Testing
  console.log('\n  [5/5] Creating 1 LIVE Open Session for Testing...');
  const openSessId = 'sess-live-today';
  await db.collection('sessions').doc(openSessId).set({
    classId: 'ty-comp-a',
    subjectId: 'sub-dbms',
    date: todayIST(),
    time: nowISTTime(),
    status: 'open',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`  ✔ Created OPEN live session: ID "${openSessId}" (ready for test RFID scans/punches!)`);

  console.log('\n  ======================================================');
  console.log('  ✨ DEMO DATA SEEDED SUCCESSFULLY! ✨');
  console.log('  ======================================================\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
