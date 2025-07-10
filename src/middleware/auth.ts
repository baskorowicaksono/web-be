import { Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AuthRequest } from '../interfaces/authInterface';

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header required',
        error: 'MISSING_AUTH_HEADER'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Bearer token required',
        error: 'INVALID_AUTH_FORMAT'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token || token.trim() === '') {
      res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify token
    const decoded = await authService.verifyToken(token, 'ACCESS');
    
    // Set user info in request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      tokenId: decoded.tokenId,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    
    // Handle different types of token errors
    let message = 'Authentication failed';
    let errorCode = 'AUTH_FAILED';

    if (error.message === 'MALFORMED_TOKEN') {
      message = 'Malformed token';
      errorCode = 'MALFORMED_TOKEN';
    } else if (error.message === 'TOKEN_EXPIRED') {
      message = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message === 'TOKEN_REVOKED') {
      message = 'Token has been revoked';
      errorCode = 'TOKEN_REVOKED';
    } else if (error.message === 'INVALID_TOKEN') {
      message = 'Invalid token';
      errorCode = 'INVALID_TOKEN';
    }

    res.status(401).json({
      success: false,
      message,
      error: errorCode
    });
    return;
  }
};
export const authenticateToken = authMiddleware;

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token && token.trim() !== '') {
      try {
        const decoded = await authService.verifyToken(token, 'ACCESS');
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          tokenId: decoded.tokenId,
          role: decoded.role,
        };
      } catch (error) {
        // Continue without auth if token is invalid
        console.warn('Optional auth failed:', error);
      }
    }
  } catch (error) {
    // Continue without auth
    console.warn('Optional auth error:', error);
  }
  
  next();
};


// Middleware to refresh token automatically if it's about to expire
export const autoRefreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        next();
        return;
    }

    // Decode without verification to check expiry
    const decoded = authService.decodeToken(token);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp ? decoded.exp : 0 - now;

    // If token expires in less than 5 minutes, suggest refresh
    if (timeUntilExpiry < 300) { // 5 minutes
      res.set('X-Token-Refresh-Suggested', 'true');
    }

    next();
  } catch (error) {
    next();
  }
};

// Middleware to handle token in both header and cookie
export const flexibleAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | null = null;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // If no header token, try cookie (for web apps)
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
        res.status(401).json({ 
            message: 'Access token required',
            error: 'MISSING_TOKEN' 
        });
        return;
    }

    const decoded = await authService.verifyToken(token, 'ACCESS');
    
    req.user = {
        userId: decoded.userId,
        email: decoded.email,
        tokenId: decoded.tokenId,
        role: decoded.role,
    };

    next();
  } catch (error: any) {
    let message = 'Invalid token';
    let errorCode = 'INVALID_TOKEN';

    if (error.name === 'TokenExpiredError') {
      message = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message === 'Token has been revoked') {
      message = 'Token has been revoked';
      errorCode = 'TOKEN_REVOKED';
    }

    res.status(401).json({ message, error: errorCode });
    return;
  }
};