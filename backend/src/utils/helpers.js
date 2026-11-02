// sbes.erp – Shared utility helpers

/**
 * Returns today's date in IST as YYYY-MM-DD
 */
function todayIST() {
  return new Date(Date.now() + 19800000).toISOString().slice(0, 10);
}

/**
 * Returns current IST time as HH:MM:SS
 */
function nowISTTime() {
  const d = new Date(Date.now() + 19800000);
  return d.toISOString().slice(11, 19);
}

/**
 * Normalize a string: lowercase, remove non-alphanumeric
 */
function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate attendance percentage
 */
function pct(present, total) {
  return total ? Math.round((present / total) * 1000) / 10 : 0;
}

/**
 * Create an AppError with a status code
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { todayIST, nowISTTime, norm, pct, AppError };
