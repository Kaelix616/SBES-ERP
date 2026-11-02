// sbes.erp – Devices routes
// Read/write device state (used for "Capture from reader" feature)

const router = require('express').Router();
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getDb, admin } = require('../config/firebase');

const db = () => getDb();

router.use(authenticate);

/**
 * GET /api/devices
 * List all devices. Staff only.
 */
router.get('/',
  authorize('admin', 'teacher'),
  async (req, res, next) => {
    try {
      const snap = await db().collection('devices').get();
      const devices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ devices });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/devices/:id
 * Get a single device status. Staff only.
 */
router.get('/:id',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const doc = await db().collection('devices').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Device not found.' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/devices/:id
 * Update device state (typically lastUid + lastScanAt from the ESP32).
 * Device or admin only.
 */
router.patch('/:id',
  authorize('device', 'admin'),
  param('id').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      if (req.body.lastUid !== undefined) updates.lastUid = req.body.lastUid;
      if (req.body.lastScanAt !== undefined) {
        updates.lastScanAt = admin.firestore.FieldValue.serverTimestamp();
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      await db().collection('devices').doc(req.params.id).set(updates, { merge: true });
      res.json({ message: 'Device updated.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
