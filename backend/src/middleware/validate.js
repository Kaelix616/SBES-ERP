// sbes.erp – Validation middleware using express-validator

const { validationResult } = require('express-validator');

/**
 * Middleware: runs after express-validator check() chains.
 * If any validation errors exist, returns 400 with details.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }
  next();
}

module.exports = { validate };
