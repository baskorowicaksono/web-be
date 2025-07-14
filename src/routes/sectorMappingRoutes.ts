import { Router } from 'express'
import { SectorMappingController } from '../controllers/sectorMappingController'
import { authMiddleware } from '../middleware/auth'
import { uploadSectorFile } from '../middleware/uploadExcel'

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Sector mapping routes
router.get('/', SectorMappingController.getSectorMappings)
router.post('/', SectorMappingController.createSectorMapping)
router.put('/:id', SectorMappingController.updateSectorMapping)
router.post('/approve', SectorMappingController.approveSectorMappings)
router.delete('/', SectorMappingController.deleteSectorMappings)
router.get("/active-mappings", SectorMappingController.getActiveMappings)
router.post("/batch-upload", SectorMappingController.batchUpload)
router.get('/upcoming-transitions', SectorMappingController.getUpcomingTransitions)
router.post('/trigger-transition', SectorMappingController.triggerTransition)
router.post('/run-daily-transitions', SectorMappingController.runDailyTransitions)

// File upload route
router.post('/upload',
  uploadSectorFile,
  SectorMappingController.processExcelUpload
)

// Helper routes
router.get('/sector-groups', SectorMappingController.getSectorGroups)
router.get('/economic-sectors', SectorMappingController.getEconomicSectors)
router.get('/stats', SectorMappingController.getSectorMappingStats)

export default router;