import { PrismaClient } from '@prisma/client'

export class SectorTransitionService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Process daily sector group transitions
   * This should be called daily (e.g., via cron job at midnight)
   */
  async processDailyTransitions(): Promise<{
    deactivatedCount: number
    activatedCount: number
    transitions: Array<{
      sektorEkonomi: string
      action: 'deactivated' | 'activated'
      mapping: any
    }>
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of day
    
    const transitions: Array<{
      sektorEkonomi: string
      action: 'deactivated' | 'activated'
      mapping: any
    }> = []

    try {
      await this.prisma.$transaction(async (tx) => {
        const mappingsToDeactivate = await tx.sectorGroupMapping.findMany({
          where: {
            isActive: true,
            tanggalAkhir: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Less than tomorrow
            }
          },
          include: {
            economicSector: true,
            sectorGroup: true
          }
        })

        if (mappingsToDeactivate.length > 0) {
          await tx.sectorGroupMapping.updateMany({
            where: {
              id: {
                in: mappingsToDeactivate.map(m => m.id)
              }
            },
            data: {
              isActive: false,
              updatedAt: new Date(),
              updatedBy: 'system_transition'
            }
          })

          mappingsToDeactivate.forEach(mapping => {
            transitions.push({
              sektorEkonomi: mapping.sektorEkonomi,
              action: 'deactivated',
              mapping: {
                id: mapping.id,
                tipeKelompok: mapping.tipeKelompok,
                namaKelompok: mapping.namaKelompok,
                tanggalAwal: mapping.tanggalAwal,
                tanggalAkhir: mapping.tanggalAkhir
              }
            })
          })
        }

        const mappingsToActivate = await tx.sectorGroupMapping.findMany({
          where: {
            isActive: false,
            tanggalAwal: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Less than tomorrow
            },
            approvedBy: {
              not: null
            }
          },
          include: {
            economicSector: true,
            sectorGroup: true
          }
        })

        if (mappingsToActivate.length > 0) {
          await tx.sectorGroupMapping.updateMany({
            where: {
              id: {
                in: mappingsToActivate.map(m => m.id)
              }
            },
            data: {
              isActive: true,
              updatedAt: new Date(),
              updatedBy: 'system_transition'
            }
          })

          mappingsToActivate.forEach(mapping => {
            transitions.push({
              sektorEkonomi: mapping.sektorEkonomi,
              action: 'activated',
              mapping: {
                id: mapping.id,
                tipeKelompok: mapping.tipeKelompok,
                namaKelompok: mapping.namaKelompok,
                tanggalAwal: mapping.tanggalAwal,
                tanggalAkhir: mapping.tanggalAkhir
              }
            })
          })
        }

        console.log(`Daily transition completed: ${mappingsToDeactivate.length} deactivated, ${mappingsToActivate.length} activated`)
      })

      return {
        deactivatedCount: transitions.filter(t => t.action === 'deactivated').length,
        activatedCount: transitions.filter(t => t.action === 'activated').length,
        transitions
      }

    } catch (error) {
      console.error('Error processing daily transitions:', error)
      throw new Error(`Failed to process daily transitions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getUpcomingTransitions(days: number = 7): Promise<{
    upcomingDeactivations: any[]
    upcomingActivations: any[]
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + days)

    try {
      const upcomingDeactivations = await this.prisma.sectorGroupMapping.findMany({
        where: {
          isActive: true,
          tanggalAkhir: {
            gte: today,
            lte: futureDate
          }
        },
        include: {
          economicSector: true,
          sectorGroup: true
        },
        orderBy: {
          tanggalAkhir: 'asc'
        }
      })

      const upcomingActivations = await this.prisma.sectorGroupMapping.findMany({
        where: {
          isActive: false,
          tanggalAwal: {
            gte: today,
            lte: futureDate
          }
        },
        include: {
          economicSector: true,
          sectorGroup: true
        },
        orderBy: {
          tanggalAwal: 'asc'
        }
      })

      return {
        upcomingDeactivations,
        upcomingActivations
      }
    } catch (error) {
      throw new Error(`Failed to get upcoming transitions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async triggerSectorTransition(sektorEkonomi: string, effectiveDate: Date, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.sectorGroupMapping.updateMany({
          where: {
            sektorEkonomi,
            isActive: true
          },
          data: {
            isActive: false,
            tanggalAkhir: effectiveDate,
            updatedAt: new Date(),
            updatedBy: userId
          }
        })

        await tx.sectorGroupMapping.updateMany({
          where: {
            sektorEkonomi,
            tanggalAwal: effectiveDate,
            isActive: false
          },
          data: {
            isActive: true,
            updatedAt: new Date(),
            updatedBy: userId
          }
        })
      })

      console.log(`Manual transition completed for sector ${sektorEkonomi} on ${effectiveDate}`)
    } catch (error) {
      throw new Error(`Failed to trigger manual transition: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}