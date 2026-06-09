function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ code: 'FORBIDDEN', message: `Role ${role} required` });
    }
    next();
  };
}

function rateLimit({ windowMs, max }) {
  const requests = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    const history = (requests.get(key) || []).filter((t) => t > windowStart);
    if (history.length >= max) {
      return res.status(429).json({ code: 'RATE_LIMITED' });
    }
    history.push(now);
    requests.set(key, history);
    next();
  };
}

module.exports = { requireRole, rateLimit };
