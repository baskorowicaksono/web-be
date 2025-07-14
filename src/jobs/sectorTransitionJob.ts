import cron from 'node-cron'
import { SectorTransitionService } from '../services/sectorTransitionService'

export class SectorTransitionJob {
  private transitionService: SectorTransitionService

  constructor() {
    this.transitionService = new SectorTransitionService()
  }

  /**
   * Start the daily transition job
   * Runs every day at midnight (00:00)
   */
  start(): void {
    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('Starting daily sector transition job...')
      
      try {
        const result = await this.transitionService.processDailyTransitions()
        
        console.log('Daily sector transition completed:', {
          deactivated: result.deactivatedCount,
          activated: result.activatedCount,
          timestamp: new Date().toISOString()
        })

        if (result.deactivatedCount > 0 || result.activatedCount > 0) {
          console.log('Transition details:', result.transitions)
        }

      } catch (error) {
        console.error('Daily sector transition failed:', error)
      }
    })

    console.log('Sector transition job scheduled - will run daily at midnight')
  }

  /**
   * Stop the job (for graceful shutdown)
   */
  stop(): void {
    cron.getTasks().forEach(task => task.destroy())
    console.log('Sector transition job stopped')
  }

  /**
   * Manual trigger for testing
   */
  async runNow(): Promise<void> {
    console.log('Running sector transition job manually...')
    const result = await this.transitionService.processDailyTransitions()
    console.log('Manual run completed:', result)
  }
}