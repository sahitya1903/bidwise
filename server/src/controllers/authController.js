const authService = require('../services/authService');

async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ token, user });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  res.json({ token, user });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
