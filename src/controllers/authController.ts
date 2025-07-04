import { Request, Response, NextFunction } from "express";
import { authService } from "../services/authService";
import { AuthRequest } from "../interfaces/authInterface";

export const register = async (req: Request, res: Response, next: NextFunction) : Promise<void> => {
    try{
        const { email, password, name } = req.body;
         if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required' });
            return;
        }

        const result = await authService.register(email, password, name);

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.status(201).json({
            message: 'User registered successfully',
            accessToken: result.accessToken,
            user: result.newUser
        });
        } catch (error) {
            next(error);
        }

}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try{
        const { email, password, name } = req.body;
         if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required' });
            return;
        }

        const result = await authService.login(email, password);

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
            message: 'Login successful',
            accessToken: result.accessToken,
            user: result.user
        });
    } catch(error) {
        next(error);
    }
}

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try{
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ message: 'Refresh token required' });
            return;
        }

        const result = await authService.refreshToken(refreshToken);

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch(error){
        next(error);
    }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Logout the specific token
      await authService.logout(token);
    }
    
    res.clearCookie('refreshToken');
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export const logoutAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try{
        if(req.user){
            await authService.logoutAll(req.user.userId);
        }

        res.clearCookie('refreshToken');
        res.json({
            message: "Logged out of all devices",
        })
    } catch(error){
        next(error);
    }
}

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try{
        res.json({
            user: req.user,
        })
    } catch(error){
        next(error);
    }
}