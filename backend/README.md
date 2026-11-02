# sbes.erp – Backend API Server

**Shahbabu Educational Society – Attendance ERP Portal**  
Developed by Abdul Wahab

Node.js + Express API layer built on top of Firebase Admin SDK. Provides REST API endpoints for the web/mobile frontend and ESP32 RFID reader.

---

## Quick Start

### 1. Prerequisites
- **Node.js** 18+ installed
- A **Firebase project** with Authentication (Email/Password) and Firestore enabled
- A **Service Account key** (JSON file) from Firebase Console

### 2. Get the Service Account key
1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. **Project Settings** → **Service Accounts** → **Generate new private key**
3. Save the downloaded JSON file as `serviceAccountKey.json` in the `backend/` folder

### 3. Configure environment
```bash
# Copy the template
cp .env.example .env

# Edit .env and set:
# - FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# - FIREBASE_API_KEY=your-web-api-key
```

### 4. Install & Run
```bash
npm install
npm run seed    # Create initial admin + device users (interactive)
npm run dev     # Start with auto-reload (development)
# or
npm start       # Start without auto-reload (production)
```

Server runs at **http://localhost:5000**

### 5. Test the health endpoint
```bash
curl http://localhost:5000/api/health
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Sign in with email + password |
| GET | `/api/auth/me` | Yes | Get current user profile |
| POST | `/api/auth/reset-password` | No | Generate password reset link |
| POST | `/api/auth/refresh` | No | Refresh ID token |

### Classes
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/classes` | Yes | Any | List all classes |
| GET | `/api/classes/:id` | Yes | Any | Get class by ID |
| POST | `/api/classes` | Yes | Admin | Create class |
| PATCH | `/api/classes/:id` | Yes | Admin/Teacher* | Update class |
| DELETE | `/api/classes/:id` | Yes | Admin | Delete class |

*Teachers can only update active session fields.

### Subjects
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/subjects?classId=xxx` | Yes | Any | List subjects (optional filter) |
| GET | `/api/subjects/:id` | Yes | Any | Get subject by ID |
| POST | `/api/subjects` | Yes | Admin | Create subject |
| PATCH | `/api/subjects/:id` | Yes | Admin | Update subject |
| DELETE | `/api/subjects/:id` | Yes | Admin | Delete subject |

### Teachers
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/teachers` | Yes | Admin | List all teachers |
| POST | `/api/teachers` | Yes | Admin | Create teacher account |
| DELETE | `/api/teachers/:uid` | Yes | Admin | Delete teacher |

### Students
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/students?classId=xxx` | Yes | Staff/Self | List students |
| GET | `/api/students/:id` | Yes | Staff/Self | Get student by ID |
| POST | `/api/students` | Yes | Staff | Register student (with RFID) |
| DELETE | `/api/students/:id` | Yes | Admin | Delete student |

### Sessions
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/sessions?classId=xxx&status=open` | Yes | Staff/Student* | List sessions |
| GET | `/api/sessions/:id` | Yes | Staff/Student* | Get session |
| POST | `/api/sessions/start` | Yes | Staff | Start attendance session |
| POST | `/api/sessions/:id/end` | Yes | Staff | End session |
| DELETE | `/api/sessions/:id` | Yes | Admin | Delete session |

*Students only see sessions of their own class.

### Attendance
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/attendance?sessionId=xxx` | Yes | Staff/Self | List attendance records |
| POST | `/api/attendance/mark` | Yes | Staff | Mark present (manual) |
| POST | `/api/attendance/rfid` | Yes | Device | Mark present (RFID scan) |
| DELETE | `/api/attendance/:id` | Yes | Staff | Remove record (mark absent) |

### Devices
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/devices` | Yes | Staff | List all devices |
| GET | `/api/devices/:id` | Yes | Staff | Get device status |
| PATCH | `/api/devices/:id` | Yes | Device/Admin | Update device state |

### Reports
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/reports/class/:classId` | Yes | Staff | Full class attendance report |
| GET | `/api/reports/student/:studentId` | Yes | Staff/Self | Individual student report |
| GET | `/api/reports/session/:sessionId` | Yes | Staff | Session attendance roster |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Server health check |

---

## Authentication Flow

1. Client calls `POST /api/auth/login` with email + password
2. Server verifies via Firebase REST API
3. Server returns `idToken` + `refreshToken`
4. Client includes `Authorization: Bearer <idToken>` in all subsequent requests
5. Token expires in 1 hour → use `POST /api/auth/refresh` with the refresh token

---

## Project Structure

```
backend/
├── .env.example                 # Environment variable template
├── .gitignore
├── package.json
├── serviceAccountKey.json       # Firebase credentials (gitignored)
└── src/
    ├── server.js                # Express app entry point
    ├── config/
    │   └── firebase.js          # Firebase Admin SDK initialization
    ├── middleware/
    │   ├── auth.js              # JWT verification + role-based authorization
    │   ├── errorHandler.js      # Global error handler
    │   └── validate.js          # Express-validator error formatter
    ├── routes/
    │   ├── auth.js              # Login, profile, password reset, token refresh
    │   ├── classes.js           # CRUD for classrooms
    │   ├── subjects.js          # CRUD for subjects
    │   ├── teachers.js          # Teacher account management
    │   ├── students.js          # Student registration with RFID
    │   ├── sessions.js          # Session lifecycle (start/end)
    │   ├── attendance.js        # Mark present/absent (manual + RFID)
    │   ├── devices.js           # ESP32 reader state
    │   └── reports.js           # Attendance percentage calculations
    ├── scripts/
    │   └── seed.js              # Initial admin/device user setup
    └── utils/
        └── helpers.js           # Shared utility functions
```

---

## Roles

| Role | Description |
|------|-------------|
| `admin` | Full access. Manages classes, subjects, teachers, students. |
| `teacher` | Can register students, start/end sessions, mark attendance, view reports. |
| `student` | Can view own attendance and percentage report. |
| `device` | ESP32 RFID reader. Can mark attendance via RFID scan. |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes* | `./serviceAccountKey.json` | Path to service account JSON |
| `FIREBASE_PROJECT_ID` | Yes* | – | Firebase project ID (alt to JSON) |
| `FIREBASE_CLIENT_EMAIL` | Yes* | – | Service account email (alt to JSON) |
| `FIREBASE_PRIVATE_KEY` | Yes* | – | Service account private key (alt to JSON) |
| `FIREBASE_API_KEY` | Yes | – | Firebase web API key (for login) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | No | `200` | Max requests per window |
| `MIN_PERCENT` | No | `75` | Attendance shortage threshold |

*Either `FIREBASE_SERVICE_ACCOUNT_PATH` or the individual credential variables are required.
