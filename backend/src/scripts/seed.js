// sbes.erp – Seed script
// Creates the initial admin user and optionally a device user
//
// Usage:
//   node src/scripts/seed.js
//
// Reads from .env for Firebase credentials

require('dotenv').config();
const { initFirebase } = require('../config/firebase');
const { getAuth, getDb, admin } = require('../config/firebase');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║  sbes.erp – Initial Setup                    ║');
  console.log('  ║  Creates admin + device users in Firebase     ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  initFirebase();
  const db = getDb();
  const auth = getAuth();

  // ── Admin user ────────────────────────────────────────────────────
  console.log('  ─── Admin Account ───');
  const adminEmail = (await ask('  Admin email [admin@sbes.erp]: ')).trim() || 'admin@sbes.erp';
  const adminPass = (await ask('  Admin password [admin123]: ')).trim() || 'admin123';
  const adminName = (await ask('  Admin name [Administrator]: ')).trim() || 'Administrator';

  try {
    // Check if admin already exists
    let adminUser;
    try {
      adminUser = await auth.getUserByEmail(adminEmail);
      console.log(`  ⚠ Admin user already exists (${adminUser.uid}). Updating Firestore role…`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        adminUser = await auth.createUser({
          email: adminEmail,
          password: adminPass,
          displayName: adminName,
        });
        console.log(`  ✔ Admin Auth user created: ${adminUser.uid}`);
      } else throw e;
    }

    await db.collection('users').doc(adminUser.uid).set({
      role: 'admin',
      name: adminName,
      email: adminEmail,
    });
    console.log(`  ✔ Admin Firestore document set.\n`);
  } catch (e) {
    console.error(`  ✖ Failed to create admin: ${e.message}\n`);
  }

  // ── Device user ──────────────────────────────────────────────────
  const createDevice = (await ask('  Create a device user for ESP32? (y/n) [y]: ')).trim().toLowerCase();
  if (createDevice !== 'n') {
    console.log('\n  ─── Device Account ───');
    const deviceEmail = (await ask('  Device email [device01@sbes.erp]: ')).trim() || 'device01@sbes.erp';
    const devicePass = (await ask('  Device password [device123]: ')).trim() || 'device123';
    const deviceName = (await ask('  Device name [Reader 1]: ')).trim() || 'Reader 1';

    try {
      let deviceUser;
      try {
        deviceUser = await auth.getUserByEmail(deviceEmail);
        console.log(`  ⚠ Device user already exists (${deviceUser.uid}). Updating Firestore role…`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          deviceUser = await auth.createUser({
            email: deviceEmail,
            password: devicePass,
            displayName: deviceName,
          });
          console.log(`  ✔ Device Auth user created: ${deviceUser.uid}`);
        } else throw e;
      }

      await db.collection('users').doc(deviceUser.uid).set({
        role: 'device',
        name: deviceName,
        email: deviceEmail,
      });
      console.log(`  ✔ Device Firestore document set.\n`);
    } catch (e) {
      console.error(`  ✖ Failed to create device: ${e.message}\n`);
    }
  }

  console.log('  ─── Done ───');
  console.log('  You can now start the server: npm run dev\n');
  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
