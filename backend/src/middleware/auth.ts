import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

function getCandidateJwtSecrets(): string[] {
  const configured = (process.env.JWT_SECRET || '').trim();
  const legacy = 'saheli_secret_key_123';
  if (!configured) return [legacy];
  if (configured === legacy) return [configured];
  // Transition support: accept old tokens signed before JWT_SECRET was configured.
  return [configured, legacy];
}

function verifyWithCandidateSecrets(token: string): any {
  const secrets = getCandidateJwtSecrets();
  let lastError: any;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded: any = verifyWithCandidateSecrets(token);
      
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
         return res.status(401).json({ success: false, error: 'User not found' });
      }
      next();
    } catch (error: any) {
      const name = String(error?.name || '');
      if (name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please sign in again.',
          code: 'TOKEN_EXPIRED',
        });
      }

      if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid session token. Please sign in again.',
          code: 'TOKEN_INVALID',
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Not authorized, token failed',
        code: 'TOKEN_FAILED',
      });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};

// Role-Based Access Control (RBAC)
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `User role '${req.user?.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};
