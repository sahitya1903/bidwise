const AppError = require('../utils/AppError');
const authService = require('../services/authService');

function readToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Protected routes: a valid JWT is required (NFR-01).
async function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(new AppError(401, 'UNAUTHORIZED'));
  try {
    req.user = await authService.verifyToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

// Public routes that show a bit more to a logged-in user (e.g. the seller sees the reserve).
async function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = await authService.verifyToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
