import { PrismaClient, TipeKelSektor } from '@prisma/client'
import { 
  SectorMappingResponse, 
  CreateSectorMappingRequest, 
  SectorMappingFilters,
  ExcelUploadRequest 
} from '../interfaces/sectorMappingInterface'
import * as XLSX from 'xlsx'

export class SectorMappingService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // Get sector mappings with filters and pagination
  async getSectorMappings(filters: SectorMappingFilters, userId: string) {
    const {
      status = 'all',
      dateRange = 'all',
      sectorCode,
      createdBy,
      page = 1,
      limit = 50
    } = filters

    // Build the where clause
    const where: any = {}

    // Status filter
    if (status !== 'all') {
      // Map frontend status to database structure
      const statusMapping = {
        'draft': { isActive: false },
        'active': { isActive: true, tanggalAkhir: null },
        'pending_approval': { isActive: false }, // Assuming pending approval means not active yet
        'approved': { isActive: true }
      }
      
      if (statusMapping[status as keyof typeof statusMapping]) {
        Object.assign(where, statusMapping[status as keyof typeof statusMapping])
      }
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      let startDate: Date

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(0)
      }

      where.createdAt = { gte: startDate }
    }

    // Sector code filter
    if (sectorCode) {
      where.OR = [
        {
          sectorGroup: {
            namaGrup: { contains: sectorCode, mode: 'insensitive' }
          }
        },
        {
          economicSector: {
            ket10se: { contains: sectorCode, mode: 'insensitive' }
          }
        }
      ]
    }

    // Created by filter
    if (createdBy) {
      where.createdBy = { contains: createdBy, mode: 'insensitive' }
    }

    const [mappings, total] = await Promise.all([
      this.prisma.sectorGroupMapping.findMany({
        where,
        include: {
          sectorGroup: true,
          economicSector: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.sectorGroupMapping.count({ where })
    ])

    // Transform to frontend format
    const transformedMappings = this.transformToFrontendFormat(mappings)

    return {
      data: transformedMappings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Transform database format to frontend format
  private transformToFrontendFormat(mappings: any[]): SectorMappingResponse[] {
    // Group mappings by sector group to match frontend expectation
    const groupedMappings = new Map<string, any[]>()

    mappings.forEach(mapping => {
      const key = `${mapping.groupId}_${mapping.namaKelompok}_${mapping.tanggalAwal?.toISOString() || 'null'}`
      if (!groupedMappings.has(key)) {
        groupedMappings.set(key, [])
      }
      groupedMappings.get(key)!.push(mapping)
    })

    return Array.from(groupedMappings.values()).map(group => {
      const firstMapping = group[0]
      
      // Determine status based on database fields
      let status: 'draft' | 'active' | 'pending_approval' | 'approved'
      if (!firstMapping.isActive) {
        status = firstMapping.approvedBy ? 'pending_approval' : 'draft'
      } else {
        status = firstMapping.tanggalAkhir ? 'approved' : 'active'
      }

      return {
        id: `${firstMapping.groupId}_${firstMapping.namaKelompok}_${firstMapping.tanggalAwal?.getTime() || 0}`,
        action: 'download', // Default action
        sectorName: firstMapping.namaKelompok,
        sectorGroups: [firstMapping.sectorGroup.namaGrup], // Group them by nama_grup
        effectiveStartDate: firstMapping.tanggalAwal?.toISOString() || new Date().toISOString(),
        endDate: firstMapping.tanggalAkhir?.toISOString(),
        createdBy: firstMapping.createdBy || 'system',
        updatedBy: firstMapping.updatedBy,
        approvedBy: firstMapping.approvedBy,
        status,
        createdAt: firstMapping.createdAt.toISOString(),
        updatedAt: firstMapping.updatedAt.toISOString()
      }
    })
  }

  // Create new sector mapping
  async createSectorMapping(request: CreateSectorMappingRequest, userId: string) {
    const {
      sectorName,
      groupId,
      sektorEkonomi,
      tipeKelompok,
      namaKelompok,
      prioritasSektor = 0,
      effectiveStartDate,
      endDate
    } = request

    // Validate business rules for nama_kelompok
    let finalNamaKelompok = namaKelompok
    if (tipeKelompok === 'NON_KLM') {
      finalNamaKelompok = 'Non KLM'
    } else if (tipeKelompok === 'HIJAU') {
      finalNamaKelompok = 'Hijau'
    } else if (tipeKelompok === 'SEKTOR_TERTENTU') {
      if (!namaKelompok || namaKelompok === 'Non KLM' || namaKelompok === 'Hijau') {
        throw new Error('nama_kelompok must be provided and cannot be "Non KLM" or "Hijau" when tipe_kelompok is "Sektor Tertentu"')
      }
      finalNamaKelompok = namaKelompok
    }

    // Create mappings for each sector
    const mappings = await Promise.all(
      sektorEkonomi.map(sektor =>
        this.prisma.sectorGroupMapping.create({
          data: {
            groupId,
            sektorEkonomi: sektor,
            tipeKelompok,
            namaKelompok: finalNamaKelompok!,
            prioritasSektor,
            tanggalAwal: new Date(effectiveStartDate),
            tanggalAkhir: endDate ? new Date(endDate) : null,
            isActive: false, // Start as draft
            createdBy: userId
          },
          include: {
            sectorGroup: true,
            economicSector: true
          }
        })
      )
    )

    return this.transformToFrontendFormat(mappings)[0]
  }

  // Update sector mapping
  async updateSectorMapping(id: string, updates: Partial<CreateSectorMappingRequest>, userId: string) {
    // Parse composite ID
    const [groupId, namaKelompok, timestamp] = id.split('_')
    const tanggalAwal = timestamp !== 'null' ? new Date(parseInt(timestamp)) : null

    const whereClause = {
      groupId: parseInt(groupId),
      namaKelompok,
      tanggalAwal
    }

    // Find existing mappings
    const existingMappings = await this.prisma.sectorGroupMapping.findMany({
      where: whereClause
    })

    if (existingMappings.length === 0) {
      throw new Error('Sector mapping not found')
    }

    // Update all related mappings
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date()
    }

    if (updates.tipeKelompok) {
      updateData.tipeKelompok = updates.tipeKelompok
      
      // Apply business rules
      if (updates.tipeKelompok === 'NON_KLM') {
        updateData.namaKelompok = 'Non KLM'
      } else if (updates.tipeKelompok === 'HIJAU') {
        updateData.namaKelompok = 'Hijau'
      } else if (updates.tipeKelompok === 'SEKTOR_TERTENTU' && updates.namaKelompok) {
        if (updates.namaKelompok === 'Non KLM' || updates.namaKelompok === 'Hijau') {
          throw new Error('nama_kelompok cannot be "Non KLM" or "Hijau" when tipe_kelompok is "Sektor Tertentu"')
        }
        updateData.namaKelompok = updates.namaKelompok
      }
    }

    if (updates.effectiveStartDate) {
      updateData.tanggalAwal = new Date(updates.effectiveStartDate)
    }

    if (updates.endDate !== undefined) {
      updateData.tanggalAkhir = updates.endDate ? new Date(updates.endDate) : null
    }

    await this.prisma.sectorGroupMapping.updateMany({
      where: whereClause,
      data: updateData
    })

    // Return updated mapping
    const updatedMappings = await this.prisma.sectorGroupMapping.findMany({
      where: whereClause,
      include: {
        sectorGroup: true,
        economicSector: true
      }
    })

    return this.transformToFrontendFormat(updatedMappings)[0]
  }

  // Approve sector mappings
  async approveSectorMappings(ids: string[], userId: string) {
    const updates = []

    for (const id of ids) {
      const [groupId, namaKelompok, timestamp] = id.split('_')
      const tanggalAwal = timestamp !== 'null' ? new Date(parseInt(timestamp)) : null

      const result = await this.prisma.sectorGroupMapping.updateMany({
        where: {
          groupId: parseInt(groupId),
          namaKelompok,
          tanggalAwal
        },
        data: {
          isActive: true,
          approvedBy: userId,
          updatedBy: userId,
          updatedAt: new Date()
        }
      })

      updates.push(result)
    }

    return { approvedCount: updates.reduce((sum, update) => sum + update.count, 0) }
  }

  // Delete sector mappings
  async deleteSectorMappings(ids: string[]) {
    const deleteCount = await Promise.all(
      ids.map(id => {
        const [groupId, namaKelompok, timestamp] = id.split('_')
        const tanggalAwal = timestamp !== 'null' ? new Date(parseInt(timestamp)) : null

        return this.prisma.sectorGroupMapping.deleteMany({
          where: {
            groupId: parseInt(groupId),
            namaKelompok,
            tanggalAwal
          }
        })
      })
    )

    return { deletedCount: deleteCount.reduce((sum, result) => sum + result.count, 0) }
  }

  // Process Excel upload
  async processExcelUpload(uploadData: ExcelUploadRequest, userId: string) {
    const { sectorName, effectiveDate, file, filename } = uploadData

    try {
      // Parse Excel file
      const workbook = XLSX.read(file, { type: 'buffer' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Validate and transform data
      const mappings = []
      
      for (const row of jsonData) {
        const data = row as any
        
        // Validate required fields
        if (!data.SectorCode || !data.GroupName) {
          continue // Skip invalid rows
        }

        // Create mapping
        const mapping = await this.prisma.sectorGroupMapping.create({
          data: {
            groupId: 1, // Default group, should be configurable
            sektorEkonomi: data.SectorCode,
            tipeKelompok: data.TipeKelompok || 'NON_KLM',
            namaKelompok: data.NamaKelompok || sectorName,
            prioritasSektor: data.Priority || 0,
            tanggalAwal: new Date(effectiveDate),
            tanggalAkhir: data.EndDate ? new Date(data.EndDate) : null,
            isActive: false, // Start as draft
            createdBy: userId
          },
          include: {
            sectorGroup: true,
            economicSector: true
          }
        })

        mappings.push(mapping)
      }

      return {
        uploadedCount: mappings.length,
        mappings: this.transformToFrontendFormat(mappings)
      }
    } catch (error) {
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get sector groups for dropdown
  async getSectorGroups() {
    return this.prisma.sectorGroup.findMany({
      where: { isActive: true },
      orderBy: { namaGrup: 'asc' }
    })
  }

  // Get economic sectors for dropdown
  async getEconomicSectors() {
    return this.prisma.economicSector.findMany({
      orderBy: { sektorEkonomi: 'asc' }
    })
  }

  // Get statistics for dashboard
  async getSectorMappingStats() {
    const [total, active, pending, draft] = await Promise.all([
      this.prisma.sectorGroupMapping.count(),
      this.prisma.sectorGroupMapping.count({ where: { isActive: true, tanggalAkhir: null } }),
      this.prisma.sectorGroupMapping.count({ where: { isActive: false, approvedBy: { not: null } } }),
      this.prisma.sectorGroupMapping.count({ where: { isActive: false, approvedBy: null } })
    ])

    // Count upcoming effective mappings
    const upcomingEffective = await this.prisma.sectorGroupMapping.count({
      where: {
        tanggalAwal: { gt: new Date() },
        isActive: true
      }
    })

    return {
      total,
      active,
      pending,
      draft,
      upcomingEffective
    }
  }

// Get active mappings for template generation
  async getActiveMappingsForTemplate() {
    try {
      // Get the latest active mapping for each economic sector
      const mappings = await this.prisma.$queryRaw<Array<{
        sektorEkonomi: string
        tipeKelompok: string
        namaKelompok: string
        groupId: number
        tanggalAwal: Date
        tanggalAkhir: Date | null
        isActive: boolean
      }>>`
        WITH ranked_mappings AS (
          SELECT 
            sektor_ekonomi,
            tipe_kelompok,
            nama_kelompok,
            group_id,
            tanggal_awal,
            tanggal_akhir,
            is_active,
            ROW_NUMBER() OVER (
              PARTITION BY sektor_ekonomi 
              ORDER BY tanggal_awal DESC, created_at DESC
            ) as row_num
          FROM sector_group_mappings 
          WHERE is_active = true
        )
        SELECT 
          sektor_ekonomi as "sektorEkonomi",
          tipe_kelompok as "tipeKelompok", 
          nama_kelompok as "namaKelompok",
          group_id as "groupId",
          tanggal_awal as "tanggalAwal",
          tanggal_akhir as "tanggalAkhir",
          is_active as "isActive"
        FROM ranked_mappings 
        WHERE row_num = 1
        ORDER BY sektor_ekonomi ASC
      `

      return mappings.map(mapping => ({
        sektorEkonomi: mapping.sektorEkonomi,
        tipeKelompok: this.mapTipeKelompokToString(mapping.tipeKelompok),
        namaKelompok: mapping.namaKelompok,
        groupId: mapping.groupId,
        tanggalAwal: mapping.tanggalAwal.toISOString(),
        tanggalAkhir: mapping.tanggalAkhir?.toISOString(),
        isActive: mapping.isActive
      }))
    } catch (error) {
      throw new Error(`Failed to fetch active mappings for template: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Batch create mappings from Excel upload
  async batchCreateFromExcel(
    mappings: Array<{
      sektorEkonomi: string
      tipeKelompok: string
      namaKelompok: string
      effectiveStartDate: string
      createdBy: string
    }>,
    userId: string
  ) {
    try {
      const createdMappings = []

      // Process each mapping in a transaction
      await this.prisma.$transaction(async (tx) => {
        for (const mappingData of mappings) {
          // Validate that the economic sector exists
          const economicSector = await tx.economicSector.findUnique({
            where: { sektorEkonomi: mappingData.sektorEkonomi }
          })

          if (!economicSector) {
            throw new Error(`Economic sector ${mappingData.sektorEkonomi} not found`)
          }

          // Map tipe_kelompok string to enum
          const tipeKelompokEnum = this.mapStringToTipeKelompok(mappingData.tipeKelompok)
          if (!tipeKelompokEnum) {
            throw new Error(`Invalid tipe_kelompok: ${mappingData.tipeKelompok}`)
          }

          // Validate business rules
          if (tipeKelompokEnum === 'NON_KLM' && mappingData.namaKelompok !== 'Non KLM') {
            throw new Error(`For tipe_kelompok "Non KLM", nama_kelompok must be "Non KLM"`)
          }

          if (tipeKelompokEnum === 'HIJAU' && mappingData.namaKelompok !== 'Hijau') {
            throw new Error(`For tipe_kelompok "Hijau", nama_kelompok must be "Hijau"`)
          }

          if (tipeKelompokEnum === 'SEKTOR_TERTENTU' && 
              (mappingData.namaKelompok === 'Non KLM' || mappingData.namaKelompok === 'Hijau')) {
            throw new Error(`For tipe_kelompok "Sektor Tertentu", nama_kelompok cannot be "Non KLM" or "Hijau"`)
          }

          // Find or create sector group
          let sectorGroup = await tx.sectorGroup.findFirst({
            where: { namaGrup: mappingData.namaKelompok }
          })

          if (!sectorGroup) {
            sectorGroup = await tx.sectorGroup.create({
              data: {
                namaGrup: mappingData.namaKelompok,
                deskripsi: `Auto-created for ${mappingData.tipeKelompok}`,
                isActive: true,
                createdBy: userId
              }
            })
          }

          // Deactivate existing active mappings for this sector
          await tx.sectorGroupMapping.updateMany({
            where: {
              sektorEkonomi: mappingData.sektorEkonomi,
              isActive: true
            },
            data: {
              isActive: false,
              tanggalAkhir: new Date(mappingData.effectiveStartDate),
              updatedBy: userId,
              updatedAt: new Date()
            }
          })

          // Create new mapping
          const newMapping = await tx.sectorGroupMapping.create({
            data: {
              groupId: sectorGroup.id,
              sektorEkonomi: mappingData.sektorEkonomi,
              tipeKelompok: tipeKelompokEnum,
              namaKelompok: mappingData.namaKelompok,
              tanggalAwal: new Date(mappingData.effectiveStartDate),
              isActive: false, // Start as draft, needs approval
              createdBy: userId
            },
            include: {
              sectorGroup: true,
              economicSector: true
            }
          })

          createdMappings.push(newMapping)
        }
      })

      return {
        uploadedCount: createdMappings.length,
        mappings: this.transformToFrontendFormat(createdMappings)
      }
    } catch (error) {
      throw new Error(`Failed to batch create mappings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Helper method to map string to TipeKelSektor enum
  private mapStringToTipeKelompok(tipeKelompok: string): 'NON_KLM' | 'SEKTOR_TERTENTU' | 'HIJAU' | null {
    switch (tipeKelompok) {
      case 'Non KLM':
        return 'NON_KLM'
      case 'Sektor Tertentu':
        return 'SEKTOR_TERTENTU'
      case 'Hijau':
        return 'HIJAU'
      default:
        return null
    }
  }

  // Helper method to map TipeKelSektor enum to string
  private mapTipeKelompokToString(tipeKelompok: string): string {
    switch (tipeKelompok) {
      case 'NON_KLM':
        return 'Non KLM'
      case 'SEKTOR_TERTENTU':
        return 'Sektor Tertentu'
      case 'HIJAU':
        return 'Hijau'
      default:
        return tipeKelompok
    }
  }
}