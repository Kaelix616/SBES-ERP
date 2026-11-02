require('dotenv').config();
const { initFirebase, getDb } = require('../config/firebase');
const { pct } = require('../utils/helpers');

async function testSummary() {
  initFirebase();
  const db = getDb();

  const [sessSnap, stdSnap, attSnap, subSnap] = await Promise.all([
    db.collection('sessions').where('classId', '==', 'ty-comp-a').get(),
    db.collection('students').where('classId', '==', 'ty-comp-a').get(),
    db.collection('attendance').where('classId', '==', 'ty-comp-a').get(),
    db.collection('subjects').where('classId', '==', 'ty-comp-a').get(),
  ]);

  const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const students = stdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const attendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const subjects = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const closedSessions = sessions.filter(s => s.status === 'closed');

  console.log('\n================================================================');
  console.log('             DEMO ATTENDANCE & PERCENTAGE REPORT');
  console.log('       Class: TY Computer Engineering (Div A) (10 Sessions)');
  console.log('================================================================');

  students
    .sort((a, b) => parseInt(a.rollNo) - parseInt(b.rollNo))
    .forEach(std => {
      const stdAtt = attendance.filter(a => a.studentId === std.id && a.status === 'present');
      const attended = stdAtt.length;
      const percentage = pct(attended, closedSessions.length);
      const isDefaulter = percentage < 75;

      const badge = isDefaulter ? '⚠️  DEFAULTER (< 75%)' : '✅  SAFE';
      console.log(`Roll ${std.rollNo.padStart(2, '0')}: ${std.name.padEnd(16)} | ${attended}/${closedSessions.length} sessions | ${String(percentage).padStart(3)}% | ${badge}`);
    });

  console.log('================================================================\n');
}

testSummary().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
