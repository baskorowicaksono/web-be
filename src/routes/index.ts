import { Router } from "express";
import authRoutes from "./authRoutes"
import sectorMappingRoutes from "./sectorMappingRoutes"

const router = Router();

router.use("/auth", authRoutes);
router.use("/sector-mappings", sectorMappingRoutes);

export default router;