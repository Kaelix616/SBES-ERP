// sbes.erp – Firebase Admin SDK initialization
// Supports both service account JSON file and individual env variables

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db;
let auth;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    auth = admin.auth();
    return;
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (saPath) {
    // Option A: Service account JSON file
    const fullPath = path.resolve(saPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`\n  ✖ Service account file not found: ${fullPath}`);
      console.error(`  → Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key`);
      console.error(`  → Save it as "serviceAccountKey.json" in the backend/ folder\n`);
      process.exit(1);
    }
    const serviceAccount = require(fullPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`  ✔ Firebase initialized with service account: ${serviceAccount.project_id}`);

  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    // Option B: Individual env variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // .env files escape newlines as literal \n
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log(`  ✔ Firebase initialized with env credentials: ${process.env.FIREBASE_PROJECT_ID}`);

  } else {
    console.error(`\n  ✖ No Firebase credentials found.`);
    console.error(`  → Set FIREBASE_SERVICE_ACCOUNT_PATH in .env (path to your JSON key file)`);
    console.error(`  → OR set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY\n`);
    process.exit(1);
  }

  db = admin.firestore();
  auth = admin.auth();
}

function getDb() {
  return db;
}

function getAuth() {
  return auth;
}

module.exports = { initFirebase, getDb, getAuth, admin };
