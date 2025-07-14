import { NextFunction, Request, Response } from 'express'
import { SectorMappingService } from '../services/sectorMappingService'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { AuthRequest } from '../interfaces/authInterface'

const prisma = new PrismaClient()
const sectorMappingService = new SectorMappingService(prisma)

// Configure multer for file upload
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || 
        file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('Only Excel files are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

export class SectorMappingController {
  // GET /api/sector-mappings
  static async getSectorMappings(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      const filters = req.query as any
      const userId = req.user!.email
      
      const result = await sectorMappingService.getSectorMappings(filters, userId)
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      console.error('Error fetching sector mappings:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sector mappings',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // POST /api/sector-mappings
  static async createSectorMapping(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      const request = req.body
      const userId = req.user!.email
      
      const result = await sectorMappingService.createSectorMapping(request, userId)
      
      res.status(201).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error creating sector mapping:', error)
      res.status(400).json({
        success: false,
        message: 'Failed to create sector mapping',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // PUT /api/sector-mappings/:id
  static async updateSectorMapping(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      const { id } = req.params
      const updates = req.body
      const userId = req.user!.email
      
      const result = await sectorMappingService.updateSectorMapping(id, updates, userId)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error updating sector mapping:', error)
      res.status(400).json({
        success: false,
        message: 'Failed to update sector mapping',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // POST /api/sector-mappings/approve
  static async approveSectorMappings(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      const { ids } = req.body
      const userId = req.user!.email
      
      const result = await sectorMappingService.approveSectorMappings(ids, userId)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error approving sector mappings:', error)
      res.status(400).json({
        success: false,
        message: 'Failed to approve sector mappings',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // DELETE /api/sector-mappings
  static async deleteSectorMappings(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      const { ids } = req.body
      
      const result = await sectorMappingService.deleteSectorMappings(ids)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error deleting sector mappings:', error)
      res.status(400).json({
        success: false,
        message: 'Failed to delete sector mappings',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  static async processExcelUpload(req: AuthRequest, res: Response, next: NextFunction) : Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const { sectorName, effectiveDate } = req.body
      const userId = req.user!.email

      const uploadData = {
        sectorName,
        effectiveDate,
        file: req.file.buffer,
        filename: req.file.originalname
      }

      const result = await sectorMappingService.processExcelUpload(uploadData, userId)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error processing Excel upload:', error)
      res.status(400).json({
        success: false,
        message: 'Failed to process Excel upload',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // GET /api/sector-mappings/sector-groups
  static async getSectorGroups(req: Request, res: Response, next: NextFunction) : Promise<void> {
    try {
      const result = await sectorMappingService.getSectorGroups()
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error fetching sector groups:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sector groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // GET /api/sector-mappings/economic-sectors
  static async getEconomicSectors(req: Request, res: Response, next: NextFunction) : Promise<void> {
    try {
      const result = await sectorMappingService.getEconomicSectors()
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error fetching economic sectors:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch economic sectors',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // GET /api/sector-mappings/stats
  static async getSectorMappingStats(req: Request, res: Response, next: NextFunction) : Promise<void> {
    try {
      const result = await sectorMappingService.getSectorMappingStats()
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error fetching sector mapping stats:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sector mapping stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // GET /api/sector-mappings/active-mappings
  // Returns latest active sector group mappings for template generation
  static async getActiveMappings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get the latest active mapping for each sector
      const activeMappings = await sectorMappingService.getActiveMappingsForTemplate()
      
      res.json({
        success: true,
        data: activeMappings
      })
    } catch (error) {
      console.error('Error fetching active mappings:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active mappings',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // POST /api/sector-mappings/batch-upload
  // Handle Excel file upload and create multiple mappings
  static async batchUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mappings } = req.body
      const userId = req.user?.userId || 'system' // Assuming you have auth middleware
      
      if (!mappings || !Array.isArray(mappings)) {
        res.status(400).json({
          success: false,
          message: 'Invalid request body. Expected mappings array.'
        })
        return
      }
      
      // Validate each mapping
      for (const mapping of mappings) {
        if (!mapping.sektorEkonomi || !mapping.tipeKelompok || !mapping.namaKelompok) {
          res.status(400).json({
            success: false,
            message: 'Each mapping must have sektorEkonomi, tipeKelompok, and namaKelompok'
          })
          return
        }
      }
      
      // Process batch upload
      const result = await sectorMappingService.batchCreateFromExcel(mappings, userId)
      
      res.json({
        success: true,
        message: `Successfully processed ${result.uploadedCount} sector mappings`,
        data: result
      })
      
    } catch (error) {
      console.error('Error in batch upload:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to process batch upload',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}