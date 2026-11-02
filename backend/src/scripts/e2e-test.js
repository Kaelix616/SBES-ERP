// sbes.erp – Comprehensive End-to-End Test Suite
// Tests all authentication, report, class, session, and student API flows.

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('   RUNNING COMPLETE E2E INTEGRATION TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Frontend Web Server
    const feRes = await fetch('http://localhost:3000');
    assert(feRes.status === 200, 'Frontend Next.js server is online (HTTP 200)');

    // 2. Backend API Health
    const beRes = await fetch('http://localhost:5000/api/health').then(r => r.json());
    assert(beRes.status === 'ok', 'Backend API is healthy');

    // 3. Admin Authentication
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'abdulwahabkazi89@gmail.com', password: 'admin123' }),
    }).then(r => r.json());

    assert(adminLogin.user?.role === 'admin', 'Admin login successful (Role: admin)');
    assert(typeof adminLogin.token === 'string' && adminLogin.token.length > 20, 'Valid JWT Bearer token issued');

    const adminToken = adminLogin.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    };

    // 4. Fetch Classes
    const classesRes = await fetch('http://localhost:5000/api/classes', { headers: authHeaders }).then(r => r.json());
    assert(Array.isArray(classesRes.classes) && classesRes.classes.length > 0, `Classes fetched (${classesRes.classes.length} class found)`);

    // 5. Fetch Class Attendance Report
    const reportRes = await fetch('http://localhost:5000/api/reports/class/ty-comp-a', { headers: authHeaders }).then(r => r.json());
    assert(Array.isArray(reportRes.report) && reportRes.report.length === 5, `Class report contains 5 students`);
    assert(Array.isArray(reportRes.summary?.subjects), 'Class report contains subject summaries');

    // 6. Fetch Defaulters
    const defRes = await fetch('http://localhost:5000/api/reports/defaulters/ty-comp-a', { headers: authHeaders }).then(r => r.json());
    assert(Array.isArray(defRes.defaulters) && defRes.defaulters.length === 2, `Defaulters identified correctly (2 students < 75%)`);

    // 7. Student Authentication
    const studentLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ty-comp-a-01@students.sbes.erp', password: 'student123' }),
    }).then(r => r.json());
    assert(studentLogin.user?.role === 'student', 'Student login successful (Role: student)');

    // 8. Individual Student Report
    const studentReport = await fetch(`http://localhost:5000/api/reports/student/demo_std_01`, {
      headers: { 'Authorization': `Bearer ${studentLogin.token}` },
    }).then(r => r.json());
    assert(studentReport.overall?.percentage === 90, `Student percentage computed accurately (90%)`);
    assert(studentReport.overall?.shortage === false, `Student correctly classified as NOT shortage`);

    console.log('\n======================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runE2ETests();
