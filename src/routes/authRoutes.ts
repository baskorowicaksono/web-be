import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.post("/register", authController.register);
router.post('/login', authController.login);
router.post('/refresh', authenticateToken, authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticateToken, authController.logoutAll);
router.get('/profile', authenticateToken, authController.getProfile);

export default router;