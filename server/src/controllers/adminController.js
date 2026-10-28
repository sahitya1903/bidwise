const authService = require('../services/authService');

async function listUsers(_req, res) {
  const users = await authService.listUsers();
  res.json({ users });
}

module.exports = { listUsers };
