import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { WebhookMonitoringService } from '../../order/payments/services/webhook-monitoring.service';

@Injectable()
export class WebhookCleanupService {
  private readonly logger = new Logger(WebhookCleanupService.name);

  constructor(
    private readonly webhookMonitoringService: WebhookMonitoringService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Clean up old webhook events daily at 2 AM
   */
  @Cron('0 2 * * *', {
    name: 'webhook-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleWebhookCleanup(): Promise<void> {
    try {
      const retentionDays = this.configService.get<number>(
        'WEBHOOK_CLEANUP_RETENTION_DAYS',
        30,
      );

      this.logger.log(
        `Starting webhook cleanup job - retention: ${retentionDays} days`,
      );

      const deletedCount =
        await this.webhookMonitoringService.cleanupOldEvents(retentionDays);

      this.logger.log(
        `Webhook cleanup completed - removed ${deletedCount} old events`,
      );

      // Log cleanup statistics
      const metrics = await this.webhookMonitoringService.getDbMetrics(24);
      this.logger.log(
        `Current webhook stats: ${metrics.totalEvents} events (24h), ` +
          `${metrics.errorRate.toFixed(2)}% error rate`,
      );
    } catch (error) {
      this.logger.error('Webhook cleanup job failed:', error);

      // You could send an alert here if cleanup fails
      // await this.alertService.sendAlert({
      //   type: 'error',
      //   title: 'Webhook Cleanup Job Failed',
      //   message: `Scheduled cleanup failed: ${error.message}`,
      //   timestamp: new Date(),
      // });
    }
  }

  /**
   * Weekly cleanup of webhook metrics cache
   */  @Cron('0 3 * * 0', {
    name: 'webhook-metrics-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  handleMetricsCleanup(): void {
    try {
      this.logger.log('Starting weekly webhook metrics cleanup');

      // Reset in-memory metrics if they get too large
      const currentMetrics = this.webhookMonitoringService.getMetrics();

      if (currentMetrics.totalRequests > 100000) {
        this.logger.log('Resetting webhook metrics due to high count');
        this.webhookMonitoringService.resetMetrics();
      }

      this.logger.log('Weekly webhook metrics cleanup completed');
    } catch (error) {
      this.logger.error('Webhook metrics cleanup failed:', error);
    }
  }

  /**
   * Monthly health report generation
   */
  @Cron('0 9 1 * *', {
    name: 'webhook-monthly-report',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async generateMonthlyReport(): Promise<void> {
    try {
      this.logger.log('Generating monthly webhook health report');

      const monthlyMetrics = await this.webhookMonitoringService.getDbMetrics(
        24 * 30, // 30 days
      );

      const report = {
        period: 'Last 30 days',
        totalEvents: monthlyMetrics.totalEvents,
        successRate: (
          (monthlyMetrics.successfulEvents / monthlyMetrics.totalEvents) *
          100
        ).toFixed(2),
        averageProcessingTime: monthlyMetrics.averageProcessingTime,
        errorRate: monthlyMetrics.errorRate.toFixed(2),
        generatedAt: new Date().toISOString(),
      };

      this.logger.log(
        `Monthly webhook report: ${JSON.stringify(report, null, 2)}`,
      );

      // You could send this report via email or store it
      // await this.emailService.sendMonthlyReport(report);
    } catch (error) {
      this.logger.error('Monthly report generation failed:', error);
    }
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async manualCleanup(retentionDays?: number): Promise<{
    deletedCount: number;
    retentionDays: number;
    completedAt: string;
  }> {
    const retention =
      retentionDays ||
      this.configService.get<number>('WEBHOOK_CLEANUP_RETENTION_DAYS', 30);

    this.logger.log(
      `Manual webhook cleanup triggered - retention: ${retention} days`,
    );

    const deletedCount =
      await this.webhookMonitoringService.cleanupOldEvents(retention);

    return {
      deletedCount,
      retentionDays: retention,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Get cleanup job status
   */
  getCleanupStatus(): {
    enabled: boolean;
    retentionDays: number;
    nextCleanup: string;
    lastCleanup?: string;
  } {
    const retentionDays = this.configService.get<number>(
      'WEBHOOK_CLEANUP_RETENTION_DAYS',
      30,
    );

    // Calculate next cleanup time (daily at 2 AM)
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(2, 0, 0, 0);

    // If it's already past 2 AM today, schedule for tomorrow
    if (now.getHours() >= 2) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }

    return {
      enabled: true,
      retentionDays,
      nextCleanup: nextCleanup.toISOString(),
      // You could store lastCleanup in database or cache
    };
  }
}
