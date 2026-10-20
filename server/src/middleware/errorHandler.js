const AppError = require('../utils/AppError');

// Unknown route → 404 in the standard error shape.
function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', undefined, `No route for ${req.method} ${req.originalUrl}`));
}

// Turns every error into { error: { code, message, details } }.
function errorHandler(err, _req, res, _next) {
  let error = err;
  if (err.type === 'entity.parse.failed') {
    error = new AppError(400, 'VALIDATION_ERROR', undefined, 'Request body is not valid JSON');
  } else if (!(err instanceof AppError)) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    error = new AppError(500, 'INTERNAL_ERROR', undefined, 'Something went wrong on the server');
  }
  const body = { error: { code: error.code, message: error.message } };
  if (error.details !== undefined) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = { notFound, errorHandler };
