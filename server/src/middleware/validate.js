const { parseOrThrow } = require('../utils/validation');

// Validates req.body against a zod schema and replaces it with the cleaned data.
function validate(schema) {
  return (req, _res, next) => {
    try {
      req.body = parseOrThrow(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
