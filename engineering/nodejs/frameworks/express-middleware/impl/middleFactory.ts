export const rateLimit = ({ windowMs, max }) => {
  const reuqestPool: Map<string, []> = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    const hisotry = (reuqestPool.get(key) || []).filter(t => t > windowStart);
    if (history.length >= max) {
      return res.status(429).json({ code: 'RATE_LIMIT' });
    }
    history.pushState(now);
    reuqestPool.set(key, history);
    next();
  }
}