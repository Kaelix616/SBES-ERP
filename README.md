# sbes.erp – Shahbabu Educational Society · Attendance ERP Portal
Developed by Abdul Wahab

RFID cards → ESP32 + RC522 → Firebase Firestore → Web app + Android app (same code).

```
sbes-erp/
├─ firmware/sbes_rfid_esp32/sbes_rfid_esp32.ino   ESP32 code
├─ firebase/firestore.rules                       Security rules
├─ firebase.json                                  Firebase CLI config
├─ web/                                           Web app (index.html, app.js, style.css, firebase-config.js)
├─ capacitor.config.json, package.json            Wraps web/ into an Android APK
```

## 1. Hardware (budget ≈ ₹1,500–2,200, limit ₹3,000)
| Item | Approx. ₹ |
|---|---|
| ESP32 DevKit (30-pin) | 450–600 |
| RC522 RFID module (with 1 card + 1 keychain) | 100–150 |
| 40 extra RFID cards/tags (13.56 MHz, MIFARE) | 400–600 |
| Active buzzer 5V | 15 |
| Green + red LED, 2 × 220 Ω resistor | 10 |
| Breadboard + jumper wires | 120 |
| 5V 1A adapter + micro-USB cable | 200–250 |
| Optional project box | 100–200 |

Prices are typical Indian-market estimates; check current rates.

## 2. RC522 wiring (RC522 is 3.3 V only – never connect it to 5 V)
| RC522 | ESP32 |
|---|---|
| SDA (SS) | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| 3.3V | 3V3 |
| GND | GND |
| IRQ | not connected |

Indicators: green LED + 220 Ω → GPIO 26 → GND · red LED + 220 Ω → GPIO 27 → GND · buzzer (+) → GPIO 25, (–) → GND.
Signals: 1 beep + green = present marked · 2 beeps + red = unknown card/no session/error · 2 short beeps = already marked.

## 3. Firestore data structure
```
users/{uid}        role: admin|teacher|student|device, name, email, [classId, studentId]
classes/{classId}  name, activeSessionId, activeSubjectId, activeSubjectName, activeDate
subjects/{id}      classId, name, code
students/{uid}     name, rollNo, rfid, classId, email, joinDate        (doc id = Auth uid)
rfidIndex/{UID}    studentId, name, rollNo, classId        ← uniqueness guard (create-only)
rollIndex/{classId_roll}  studentId, name                  ← uniqueness guard (create-only)
sessions/{id}      classId, subjectId, subjectName, date, status: open|closed, startedBy
attendance/{sessionId_studentId}  sessionId, classId, subjectId, studentId, name, rollNo,
                                  date, time, status:'present', source: rfid|manual, ts
devices/{deviceId} lastUid, lastScanAt     (used by "Capture from reader")
```
Only *present* rows are stored. Absent = a closed session with no attendance row.

**Duplicate protection:** registration writes the student plus `rfidIndex/{UID}` and `rollIndex/{class_roll}` in one batch. Index documents can be created but never updated (see rules), so a second registration of the same UID or roll number is rejected by Firestore itself. The form also pre-checks and shows a clear message.

**Percentages** (`calc()` in `web/app.js`):
- Subject % = present sessions of that subject ÷ closed sessions of that subject × 100
- Overall % = all present ÷ all closed sessions × 100
- Only sessions on/after the student's join date count. Below 75 % (`MIN_PERCENT`) is flagged.

## 4. Deployment, step by step
**A. Firebase project**
1. console.firebase.google.com → Add project → `sbes-erp`.
2. Build → Authentication → Get started → enable **Email/Password**.
3. Build → Firestore Database → Create database (production mode, region `asia-south1` Mumbai).
4. Project settings → Your apps → add **Web app** → copy the config into `web/firebase-config.js`.
5. Install CLI: `npm i -g firebase-tools`, then `firebase login` and `firebase use --add` (select your project).
6. Publish rules: `firebase deploy --only firestore:rules`

**B. Create the first admin (one time, in the console)**
1. Authentication → Users → Add user (e.g. `admin@sbes.erp`, strong password). Copy its **UID**.
2. Firestore → Start collection `users` → Document ID = that UID → fields: `role` = `admin`, `name` = `Administrator`, `email` = `admin@sbes.erp`.
3. Repeat for the reader: Auth user `device01@sbes.erp` + `users/{its UID}` with `role` = `device`, `name` = `Reader 1`.

**C. Host the web app**
`firebase deploy --only hosting` → your site is at `https://<project>.web.app`.
(For local testing: `cd web && npx serve`, then add `localhost` under Authentication → Settings → Authorized domains.)

**D. First use**
1. Sign in as admin → **Classes** → add your classroom → copy its **Class ID**.
2. **Subjects** → add subjects. **Teachers** → create teacher logins.

**E. Flash the ESP32**
1. Arduino IDE → Boards Manager → install *esp32* (Espressif). Library Manager → install **MFRC522** and **ArduinoJson** (v7).
2. Open the `.ino`, fill in Wi-Fi, `API_KEY`, `PROJECT_ID`, device email/password and `CLASS_ID`.
3. Board "ESP32 Dev Module" → Upload. Open Serial Monitor at 115200; you should see "sbes.erp reader ready".

**F. Register students**
Students tab → pick class → type name and roll number → tap a new card on the reader → press **Capture from reader** → **Register student**.
You will see: *"Student Rahul Sharma has been successfully registered in sbes.erp."* together with the student's login email and password (give these to the student).

**G. Take attendance**
Teacher → Take attendance → choose subject → **Start session**. Students tap cards; the table updates live. Use *Mark present/absent* for manual fixes. **End session** when finished (only closed sessions count toward percentages).

**H. Android app (same code)**
Requires Node.js and Android Studio.
```
npm install
npx cap add android
npx cap sync
npx cap open android      # Build → Build APK(s)
```
Re-run `npx cap sync` after every change in `web/`. For Play Store release, create a signed bundle in Android Studio.

## 5. Adding more classrooms later
Admin adds the class and subjects, flashes another ESP32 with a new `DEVICE_ID` and `CLASS_ID` (and a new `device` Auth user, or reuse the same one). No code changes needed.

## 6. Security notes
- Never share the admin account; teachers can register students and run sessions but cannot create teachers or delete students.
- ESP32 uses `setInsecure()` for simple TLS; for production pin Google's root CA with `setCACert()`.
- Restrict the Firebase API key (Google Cloud Console → Credentials) to your hosting domain and Identity Toolkit/Firestore APIs; enable Firestore daily backups.
- Deleting a student removes their records in Firestore; disable the login in Authentication manually.
- Cloning a card UID is possible with MIFARE Classic; for exams or high-stakes use, add a PIN or camera check.
