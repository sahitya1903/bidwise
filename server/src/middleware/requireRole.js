const AppError = require('../utils/AppError');

// Use after requireAuth. Example: router.get('/users', requireAuth, requireRole('admin'), ...)
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN'));
    return next();
  };
}

module.exports = requireRole;
