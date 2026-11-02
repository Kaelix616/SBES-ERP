// sbes.erp – Shahbabu Educational Society Attendance ERP Portal | Developed by Abdul Wahab
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, DEVICE_ID, MIN_PERCENT } from "./firebase-config.js";

if (firebaseConfig.apiKey.startsWith("PASTE")) {
  document.querySelector("#app").innerHTML = '<div class="card"><h2>Setup needed</h2><p>Open <code>web/firebase-config.js</code> and paste your Firebase web app config, then redeploy.</p></div>';
  throw new Error("firebase-config.js not filled in");
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app), db = getFirestore(app);
// Second app instance: lets admin/teacher create accounts without being signed out.
const secAuth = getAuth(initializeApp(firebaseConfig, "secondary"));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10); // IST date
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const pct = (p, t) => (t ? Math.round((p / t) * 1000) / 10 : 0);

let me = null, classes = [], subjects = [], unsubs = [];
const stopLive = () => { unsubs.forEach((u) => u()); unsubs = []; };
const q = (col, ...w) => getDocs(query(collection(db, col), ...w.map((x) => where(...x))));
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function friendly(e) {
  const c = e.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Email or password is incorrect.";
  if (c.includes("email-already-in-use")) return "A login with this email already exists.";
  if (c.includes("weak-password")) return "Password must be at least 6 characters.";
  if (c.includes("permission-denied")) return "You do not have permission for this action.";
  if (c.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  return e.message || "Something went wrong.";
}
function banner(type, text) { const b = $("#banner"); if (b) { b.className = "msg " + type; b.textContent = text; b.hidden = false; b.scrollIntoView({ block: "nearest" }); } }

/* ---------------- Login ---------------- */
function showLogin(err = "") {
  stopLive(); $("#who").innerHTML = "";
  $("#app").innerHTML = `<div class="card login"><h2>Sign in</h2>
    ${err ? `<div class="msg err">${esc(err)}</div>` : ""}
    <label for="em">Email</label><input id="em" type="email" autocomplete="username">
    <label for="pw" style="margin-top:10px">Password</label><input id="pw" type="password" autocomplete="current-password">
    <div style="margin-top:14px;display:flex;gap:10px;align-items:center"><button class="btn" id="go">Sign in</button>
    <button class="btn alt sm" id="fg">Reset password</button></div></div>`;
  const go = async () => {
    $("#go").disabled = true;
    try { await signInWithEmailAndPassword(auth, $("#em").value.trim(), $("#pw").value); }
    catch (e) { showLogin(friendly(e)); }
  };
  $("#go").onclick = go; $("#pw").onkeydown = (e) => e.key === "Enter" && go();
  $("#fg").onclick = async () => {
    const em = $("#em").value.trim(); if (!em) return alert("Enter your email first.");
    try { await sendPasswordResetEmail(auth, em); alert("Password reset email sent."); } catch (e) { alert(friendly(e)); }
  };
}

onAuthStateChanged(auth, async (u) => {
  if (!u) { me = null; return showLogin(); }
  try {
    const s = await getDoc(doc(db, "users", u.uid));
    if (!s.exists() || !["admin", "teacher", "student"].includes(s.data().role)) { await signOut(auth); return showLogin("This account has no portal role. Contact the administrator."); }
    me = { uid: u.uid, ...s.data() };
    const [c, sb] = await Promise.all([getDocs(collection(db, "classes")), getDocs(collection(db, "subjects"))]);
    classes = rows(c); subjects = rows(sb);
    $("#who").innerHTML = `${esc(me.name)} <span class="pill ok">${esc(me.role)}</span><br><a href="#" id="out">Sign out</a>`;
    $("#out").onclick = (e) => { e.preventDefault(); signOut(auth); };
    me.role === "student" ? studentView() : staffView();
  } catch (e) { showLogin(friendly(e)); }
});

/* ---------------- Attendance maths ---------------- */
// Counts only CLOSED sessions on/after the student's join date.
function calc(student, sessions, att) {
  const present = new Set(att.map((a) => a.sessionId));
  const per = {}; let P = 0, T = 0;
  for (const s of sessions) {
    if (s.status !== "closed" || s.date < (student.joinDate || "0000")) continue;
    const r = (per[s.subjectId] ??= { total: 0, present: 0 });
    r.total++; T++;
    if (present.has(s.id)) { r.present++; P++; }
  }
  return { per, P, T, overall: pct(P, T) };
}
const subjName = (id) => subjects.find((s) => s.id === id)?.name || "Unknown";
const pill = (v, t) => (t ? `<span class="pill ${v >= MIN_PERCENT ? "ok" : "bad"}">${v}%</span>` : `<span class="muted">–</span>`);

/* ---------------- Student view ---------------- */
async function studentView() {
  const sid = me.studentId || me.uid;
  const st = await getDoc(doc(db, "students", sid));
  if (!st.exists()) return ($("#app").innerHTML = `<div class="msg err">Student record not found.</div>`);
  const student = { id: st.id, ...st.data() };
  const [sSnap, aSnap] = await Promise.all([q("sessions", ["classId", "==", student.classId]), q("attendance", ["studentId", "==", sid])]);
  const r = calc(student, rows(sSnap), rows(aSnap));
  const cls = classes.find((c) => c.id === student.classId);
  const need = Math.max(0, 3 * r.T - 4 * r.P), skip = Math.max(0, Math.floor((4 * r.P) / 3 - r.T));
  const note = !r.T ? "No classes have been held yet."
    : r.overall >= MIN_PERCENT ? `You can miss up to ${skip} more class${skip === 1 ? "" : "es"} and stay at ${MIN_PERCENT}%.`
    : `Attend the next ${need} class${need === 1 ? "" : "es"} in a row to reach ${MIN_PERCENT}%.`;
  $("#app").innerHTML = `<div class="card"><h2>${esc(student.name)} · Roll ${esc(student.rollNo)} · ${esc(cls?.name || "")}</h2>
    <div class="big" style="color:var(--${r.overall >= MIN_PERCENT || !r.T ? "ok" : "bad"})">${r.T ? r.overall + "%" : "–"}</div>
    <p>Overall attendance: ${r.P} present of ${r.T} classes. ${note}</p></div>
    <div class="card"><h2>Subject-wise attendance</h2><div class="scroll"><table><tr><th>Subject</th><th>Present</th><th>Total</th><th>%</th></tr>
    ${Object.entries(r.per).map(([id, v]) => `<tr><td>${esc(subjName(id))}</td><td>${v.present}</td><td>${v.total}</td><td>${pill(pct(v.present, v.total), v.total)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No data yet.</td></tr>`}
    </table></div></div>`;
}

/* ---------------- Staff shell ---------------- */
function staffView() {
  const tabs = me.role === "admin"
    ? [["Classes", tabClasses], ["Subjects", tabSubjects], ["Teachers", tabTeachers], ["Students", tabStudents], ["Take attendance", tabSession], ["Reports", tabReports]]
    : [["Take attendance", tabSession], ["Students", tabStudents], ["Reports", tabReports]];
  $("#app").innerHTML = `<div class="tabs">${tabs.map((t, i) => `<button data-i="${i}">${t[0]}</button>`).join("")}</div><div id="banner" class="msg" hidden></div><div id="panel"></div>`;
  const open = (i) => { stopLive(); document.querySelectorAll(".tabs button").forEach((b, j) => b.classList.toggle("on", i === j)); $("#banner").hidden = true; tabs[i][1](); };
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => open(+b.dataset.i)));
  open(0);
}
const classOpts = (sel) => classes.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("") || `<option value="">No classes yet</option>`;
const needClass = () => !classes.length && ($("#panel").innerHTML = `<div class="card">Add a class first (Admin → Classes).</div>`, true);
async function reloadMeta() {
  const [c, s] = await Promise.all([getDocs(collection(db, "classes")), getDocs(collection(db, "subjects"))]);
  classes = rows(c); subjects = rows(s);
}

/* ---------------- Admin: classes / subjects / teachers ---------------- */
function tabClasses() {
  $("#panel").innerHTML = `<div class="card"><h2>Add class</h2><div class="row"><div><label>Class name</label><input id="cn" placeholder="e.g. Class 10 – A"></div></div>
    <button class="btn" id="add">Add class</button></div>
    <div class="card"><h2>Classes</h2><div class="scroll"><table><tr><th>Name</th><th>Class ID (use in ESP32 code)</th></tr>
    ${classes.map((c) => `<tr><td>${esc(c.name)}</td><td><code>${c.id}</code></td></tr>`).join("") || `<tr><td colspan="2" class="muted">None yet.</td></tr>`}</table></div></div>`;
  $("#add").onclick = async () => {
    const name = $("#cn").value.trim(); if (!name) return banner("err", "Enter a class name.");
    try { await addDoc(collection(db, "classes"), { name, activeSessionId: "", activeSubjectId: "", activeSubjectName: "", activeDate: "", createdAt: serverTimestamp() });
      await reloadMeta(); banner("ok", `Class ${name} added.`); tabClasses(); } catch (e) { banner("err", friendly(e)); }
  };
}
function tabSubjects() {
  if (needClass()) return;
  $("#panel").innerHTML = `<div class="card"><h2>Add subject</h2><div class="row"><div><label>Class</label><select id="sc">${classOpts()}</select></div>
    <div><label>Subject name</label><input id="sn"></div><div><label>Code</label><input id="sk"></div></div><button class="btn" id="add">Add subject</button></div>
    <div class="card"><h2>Subjects</h2><div class="scroll"><table><tr><th>Class</th><th>Subject</th><th>Code</th></tr>
    ${subjects.map((s) => `<tr><td>${esc(classes.find((c) => c.id === s.classId)?.name)}</td><td>${esc(s.name)}</td><td>${esc(s.code)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">None yet.</td></tr>`}</table></div></div>`;
  $("#add").onclick = async () => {
    const name = $("#sn").value.trim(); if (!name) return banner("err", "Enter a subject name.");
    try { await addDoc(collection(db, "subjects"), { classId: $("#sc").value, name, code: $("#sk").value.trim() });
      await reloadMeta(); banner("ok", `Subject ${name} added.`); tabSubjects(); } catch (e) { banner("err", friendly(e)); }
  };
}
async function createAuthUser(email, password) {
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);
  return cred.user;
}
async function tabTeachers() {
  const list = rows(await q("users", ["role", "==", "teacher"]));
  $("#panel").innerHTML = `<div class="card"><h2>Add teacher</h2><div class="row"><div><label>Name</label><input id="tn"></div>
    <div><label>Email</label><input id="te" type="email"></div><div><label>Password</label><input id="tp" type="text" minlength="6"></div></div>
    <button class="btn" id="add">Create teacher login</button></div>
    <div class="card"><h2>Teachers</h2><div class="scroll"><table><tr><th>Name</th><th>Email</th></tr>${list.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.email)}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">None yet.</td></tr>`}</table></div></div>`;
  $("#add").onclick = async () => {
    const name = $("#tn").value.trim(), email = $("#te").value.trim(), pw = $("#tp").value;
    if (!name || !email) return banner("err", "Name and email are required.");
    try { const u = await createAuthUser(email, pw);
      await setDoc(doc(db, "users", u.uid), { role: "teacher", name, email, createdAt: serverTimestamp() });
      await signOut(secAuth); banner("ok", `Teacher ${name} has been successfully registered in sbes.erp.`); tabTeachers();
    } catch (e) { banner("err", friendly(e)); }
  };
}

/* ---------------- Students: register + list ---------------- */
async function tabStudents() {
  if (needClass()) return;
  let cid = classes[0].id;
  const draw = async () => {
    const list = rows(await q("students", ["classId", "==", cid])).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
    $("#list").innerHTML = `<table><tr><th>Roll</th><th>Name</th><th>RFID UID</th><th>Login email</th><th>Joined</th>${me.role === "admin" ? "<th></th>" : ""}</tr>
      ${list.map((s) => `<tr><td>${esc(s.rollNo)}</td><td>${esc(s.name)}</td><td><code>${esc(s.rfid)}</code></td><td>${esc(s.email)}</td><td>${esc(s.joinDate)}</td>
      ${me.role === "admin" ? `<td><button class="btn danger sm" data-del="${s.id}">Delete</button></td>` : ""}</tr>`).join("") || `<tr><td colspan="6" class="muted">No students in this class yet.</td></tr>`}</table>`;
    document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const s = list.find((x) => x.id === b.dataset.del);
      if (!confirm(`Delete ${s.name}? Attendance history stays; the login account must be disabled in Firebase Console.`)) return;
      const bt = writeBatch(db);
      bt.delete(doc(db, "students", s.id)); bt.delete(doc(db, "users", s.id));
      bt.delete(doc(db, "rfidIndex", s.rfid)); bt.delete(doc(db, "rollIndex", `${s.classId}_${norm(s.rollNo)}`));
      try { await bt.commit(); banner("ok", `Student ${s.name} has been removed from sbes.erp.`); draw(); } catch (e) { banner("err", friendly(e)); }
    }));
  };
  $("#panel").innerHTML = `<div class="card"><h2>Register student</h2>
    <div class="row"><div><label>Class</label><select id="cls">${classOpts(cid)}</select></div>
    <div><label>Student name</label><input id="nm"></div><div><label>Roll number</label><input id="rn"></div></div>
    <div class="row"><div><label>RFID card UID</label><input id="uid" placeholder="Scan card, then press Capture"></div>
    <div><label>Login password for student</label><input id="pw" value="${Math.random().toString(36).slice(2, 10)}"></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn alt" id="cap">Capture from reader</button><button class="btn" id="reg">Register student</button></div>
    <p class="muted" id="capmsg" style="margin-bottom:0"></p></div>
    <div class="card"><h2>Students in class</h2><div class="scroll" id="list"></div></div>`;
  $("#cls").onchange = (e) => { cid = e.target.value; draw(); };
  $("#cap").onclick = () => {   // wait for the next unknown card scanned on the reader
    $("#capmsg").textContent = "Waiting… tap the new card on the reader."; const start = Date.now();
    const un = onSnapshot(doc(db, "devices", DEVICE_ID), (s) => {
      const d = s.data(); if (!d?.lastUid || !d.lastScanAt) return;
      if (d.lastScanAt.toMillis() > start - 2000) { $("#uid").value = d.lastUid; $("#capmsg").textContent = `Captured card ${d.lastUid}.`; un(); }
    }, () => ($("#capmsg").textContent = "Cannot read the reader. Type the UID manually."));
    unsubs.push(un); setTimeout(un, 60000);
  };
  $("#reg").onclick = async () => {
    const f = { classId: $("#cls").value, name: $("#nm").value.trim(), rollNo: $("#rn").value.trim(),
      rfid: $("#uid").value.trim().toUpperCase().replace(/[^0-9A-F]/g, ""), pw: $("#pw").value };
    $("#reg").disabled = true;
    try { await registerStudent(f); $("#nm").value = $("#rn").value = $("#uid").value = ""; $("#pw").value = Math.random().toString(36).slice(2, 10); draw(); }
    catch (e) { banner("err", e.message && !e.code ? e.message : friendly(e)); }
    $("#reg").disabled = false;
  };
  draw();
}
async function registerStudent(f) {
  if (!f.name || !f.rollNo || !f.rfid) throw new Error("Student name, roll number and RFID UID are all required.");
  if (f.pw.length < 6) throw new Error("Password must be at least 6 characters.");
  const rollKey = `${f.classId}_${norm(f.rollNo)}`;
  // Duplicate protection (friendly pre-check; the rules enforce it atomically too)
  const [rf, rl] = await Promise.all([getDoc(doc(db, "rfidIndex", f.rfid)), getDoc(doc(db, "rollIndex", rollKey))]);
  if (rf.exists()) throw new Error(`RFID UID ${f.rfid} is already assigned to ${rf.data().name} (Roll ${rf.data().rollNo}). Use a different card.`);
  if (rl.exists()) throw new Error(`Roll number ${f.rollNo} is already registered in this class (${rl.data().name}).`);
  const email = `${norm(f.classId)}-${norm(f.rollNo)}@students.sbes.erp`;
  const user = await createAuthUser(email, f.pw);
  const id = user.uid, joinDate = today();
  try {
    const b = writeBatch(db);
    b.set(doc(db, "students", id), { uid: id, name: f.name, rollNo: f.rollNo, rfid: f.rfid, classId: f.classId, email, joinDate, createdAt: serverTimestamp() });
    b.set(doc(db, "users", id), { role: "student", name: f.name, email, classId: f.classId, studentId: id });
    b.set(doc(db, "rfidIndex", f.rfid), { studentId: id, name: f.name, rollNo: f.rollNo, classId: f.classId });
    b.set(doc(db, "rollIndex", rollKey), { studentId: id, name: f.name });
    await b.commit();
  } catch (e) {
    await deleteUser(user).catch(() => {});   // roll back orphan login
    if ((e.code || "").includes("permission-denied")) throw new Error("This roll number or RFID UID is already registered, so nothing was saved.");
    throw e;
  }
  await signOut(secAuth);
  banner("ok", `Student ${f.name} has been successfully registered in sbes.erp. Login: ${email} / password: ${f.pw}`);
}

/* ---------------- Teacher: session control ---------------- */
async function tabSession() {
  if (needClass()) return;
  let cid = classes[0].id;
  const draw = async () => {
    const cls = (await getDoc(doc(db, "classes", cid))).data();
    classes = classes.map((c) => (c.id === cid ? { id: cid, ...cls } : c));
    const subs = subjects.filter((s) => s.classId === cid);
    const active = cls.activeSessionId;
    $("#panel").innerHTML = `<div class="card"><h2>Class session</h2>
      <div class="row"><div><label>Class</label><select id="cls">${classOpts(cid)}</select></div>
      ${active ? "" : `<div><label>Subject</label><select id="sub">${subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("") || "<option value=''>Add subjects first</option>"}</select></div>`}</div>
      ${active ? `<p class="live"><span class="dot"></span> ${esc(cls.activeSubjectName)} · ${esc(cls.activeDate)} – students can tap cards now.</p><button class="btn danger" id="end">End session</button>`
               : `<button class="btn" id="start">Start session</button>`}</div>
      ${active ? `<div class="card"><h2>Live attendance <span id="cnt" class="pill ok"></span></h2><div class="scroll" id="live"></div></div>` : ""}`;
    $("#cls").onchange = (e) => { cid = e.target.value; stopLive(); draw(); };
    if (!active) {
      $("#start").onclick = async () => {
        const sid = $("#sub")?.value; if (!sid) return banner("err", "Choose a subject first.");
        try { const ref = await addDoc(collection(db, "sessions"), { classId: cid, subjectId: sid, subjectName: subjName(sid), date: today(), status: "open", startedBy: me.uid, startedAt: serverTimestamp() });
          await updateDoc(doc(db, "classes", cid), { activeSessionId: ref.id, activeSubjectId: sid, activeSubjectName: subjName(sid), activeDate: today() });
          draw(); } catch (e) { banner("err", friendly(e)); }
      };
    } else {
      $("#end").onclick = async () => {
        if (!confirm("End this session? Absent students are counted from now.")) return;
        try { await updateDoc(doc(db, "sessions", active), { status: "closed", endedAt: serverTimestamp() });
          await updateDoc(doc(db, "classes", cid), { activeSessionId: "", activeSubjectId: "", activeSubjectName: "", activeDate: "" });
          stopLive(); draw(); banner("ok", "Session ended and saved."); } catch (e) { banner("err", friendly(e)); }
      };
      const students = rows(await q("students", ["classId", "==", cid])).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
      unsubs.push(onSnapshot(query(collection(db, "attendance"), where("sessionId", "==", active)), (snap) => {
        const here = new Map(snap.docs.map((d) => [d.data().studentId, d.data()]));
        $("#cnt").textContent = `${here.size}/${students.length} present`;
        $("#live").innerHTML = `<table><tr><th>Roll</th><th>Name</th><th>Status</th><th>Time</th><th></th></tr>${students.map((s) => { const a = here.get(s.id);
          return `<tr><td>${esc(s.rollNo)}</td><td>${esc(s.name)}</td><td>${a ? '<span class="pill ok">Present</span>' : '<span class="pill bad">Absent</span>'}</td><td>${a ? esc(a.time) + " (" + esc(a.source) + ")" : ""}</td>
          <td><button class="btn alt sm" data-s="${s.id}">${a ? "Mark absent" : "Mark present"}</button></td></tr>`; }).join("")}</table>`;
        document.querySelectorAll("[data-s]").forEach((b) => (b.onclick = async () => {
          const s = students.find((x) => x.id === b.dataset.s), ref = doc(db, "attendance", `${active}_${s.id}`);
          try { here.has(s.id) ? await deleteDoc(ref) : await setDoc(ref, { sessionId: active, classId: cid, subjectId: cls.activeSubjectId, studentId: s.id, name: s.name, rollNo: s.rollNo, date: cls.activeDate, time: new Date().toTimeString().slice(0, 8), status: "present", source: "manual", ts: serverTimestamp() });
          } catch (e) { banner("err", friendly(e)); }
        }));
      }));
    }
  };
  draw();
}

/* ---------------- Reports ---------------- */
async function tabReports() {
  if (needClass()) return;
  let cid = classes[0].id;
  const draw = async () => {
    const [sSnap, stSnap, aSnap] = await Promise.all([q("sessions", ["classId", "==", cid]), q("students", ["classId", "==", cid]), q("attendance", ["classId", "==", cid])]);
    const sessions = rows(sSnap), att = rows(aSnap);
    const students = rows(stSnap).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
    const subs = subjects.filter((s) => s.classId === cid);
    const data = students.map((s) => ({ s, r: calc(s, sessions, att.filter((a) => a.studentId === s.id)) }));
    const held = (id) => sessions.filter((x) => x.status === "closed" && x.subjectId === id).length;
    $("#rep").innerHTML = `<table><tr><th>Roll</th><th>Name</th>${subs.map((x) => `<th>${esc(x.name)} (${held(x.id)})</th>`).join("")}<th>Overall</th></tr>
      ${data.map(({ s, r }) => `<tr><td>${esc(s.rollNo)}</td><td>${esc(s.name)}</td>${subs.map((x) => { const v = r.per[x.id] || { present: 0, total: 0 }; return `<td>${v.present}/${v.total} ${pill(pct(v.present, v.total), v.total)}</td>`; }).join("")}<td>${r.P}/${r.T} ${pill(r.overall, r.T)}</td></tr>`).join("") || `<tr><td class="muted">No students yet.</td></tr>`}</table>`;
    $("#csv").onclick = () => {
      const head = ["Roll", "Name", ...subs.map((x) => x.name + " %"), "Overall %"];
      const lines = data.map(({ s, r }) => [s.rollNo, s.name, ...subs.map((x) => { const v = r.per[x.id]; return v ? pct(v.present, v.total) : ""; }), r.T ? r.overall : ""]);
      const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `attendance-${today()}.csv`; a.click();
    };
  };
  $("#panel").innerHTML = `<div class="card"><h2>Attendance report</h2><div class="row"><div><label>Class</label><select id="cls">${classOpts(cid)}</select></div></div>
    <p class="muted">Percent = classes attended ÷ classes held (closed sessions since the student joined). Below ${MIN_PERCENT}% is flagged red. Numbers in brackets are classes held.</p>
    <button class="btn alt" id="csv">Download CSV</button><div class="scroll" id="rep" style="margin-top:12px"></div></div>`;
  $("#cls").onchange = (e) => { cid = e.target.value; draw(); };
  draw();
}
