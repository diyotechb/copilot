import jwt from 'jsonwebtoken';

// Replace with your Cognito public key or JWKS verification logic in production
const COGNITO_PUBLIC_KEY = 'YOUR_COGNITO_PUBLIC_KEY';

export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.decode(token); // Use jwt.verify in production!
    const groups = payload['cognito:groups'] || [];
    if (groups.includes('admin')) {
      req.user = payload;
      return next();
    }
    return res.status(403).json({ error: 'Admin access required' });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}