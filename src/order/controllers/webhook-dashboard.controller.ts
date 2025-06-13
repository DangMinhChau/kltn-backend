import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  WebhookDashboardOverviewResponseDto,
  WebhookEventsResponseDto,
  WebhookHealthStatusDto,
} from './dto/webhook-dashboard.dto';
import { WebhookMonitoringService } from '../payments/services/webhook-monitoring.service';
import { WebhookAlertService } from '../payments/services/webhook-alert.service';
import { WebhookCleanupService } from '../../common/services/webhook-cleanup.service';
// import { AdminGuard } from '../../common/guards/admin.guard'; // Uncomment when available

interface TestAlertDto {
  type: 'error' | 'warning' | 'critical';
  title: string;
  message: string;
}

@Controller('admin/webhook-dashboard')
// @UseGuards(AdminGuard) // Uncomment when admin authentication is available
export class WebhookDashboardController {
  constructor(
    private readonly webhookMonitoringService: WebhookMonitoringService,
    private readonly webhookAlertService: WebhookAlertService,
    private readonly webhookCleanupService: WebhookCleanupService,
    private readonly configService: ConfigService,
  ) {} /**
   * Get comprehensive webhook dashboard data
   */
  @Get('overview')
  async getDashboardOverview(@Query('hours') hours?: string) {
    const periodHours = hours ? parseInt(hours, 10) : 24;

    const [
      currentMetrics,
      dbMetrics,
      healthStatus,
      recentEvents,
      performanceSummary,
      cleanupStatus,
    ] = await Promise.all([
      this.webhookMonitoringService.getMetrics(),
      this.webhookMonitoringService.getDbMetrics(periodHours),
      this.webhookMonitoringService.getHealthStatus(),
      this.webhookMonitoringService.getRecentEventsFromDb(50),
      this.webhookMonitoringService.getPerformanceSummary(60),
      this.webhookCleanupService.getCleanupStatus(),
    ]);

    return {
      overview: {
        status: healthStatus.status,
        issues: healthStatus.issues,
        period: `${periodHours} hours`,
        generatedAt: new Date().toISOString(),
      },
      metrics: {
        current: currentMetrics,
        database: dbMetrics,
        performance: performanceSummary,
      },
      recentEvents: recentEvents.slice(0, 10), // Latest 10 events
      cleanup: cleanupStatus,
      alertConfiguration: this.getAlertConfiguration(),
    };
  }

  /**
   * Get detailed webhook metrics
   */
  @Get('metrics')
  async getDetailedMetrics(
    @Query('period') period: string = '24h',
    @Query('breakdown') breakdown: string = 'hourly',
  ) {
    const periodHours = this.parsePeriod(period);

    const [dbMetrics, performanceSummary] = await Promise.all([
      this.webhookMonitoringService.getDbMetrics(periodHours),
      this.webhookMonitoringService.getPerformanceSummary(periodHours * 60),
    ]);

    return {
      period: `${periodHours} hours`,
      breakdown,
      metrics: dbMetrics,
      performance: performanceSummary,
      trends: await this.calculateTrends(periodHours),
    };
  } /**
   * Get webhook events with filtering and pagination
   */
  @Get('events')
  async getWebhookEvents(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('orderId') orderId?: string,
    @Query('success') success?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (orderId) {
      const events =
        await this.webhookMonitoringService.getEventsByOrderIdFromDb(orderId);
      return {
        events,
        total: events.length,
        page: 1,
        limit: events.length,
        filters: { orderId },
      };
    }

    // For now, return recent events (can be enhanced with actual filtering)
    const events =
      await this.webhookMonitoringService.getRecentEventsFromDb(limitNumber);

    return {
      events,
      total: events.length,
      page: pageNumber,
      limit: limitNumber,
      filters: { success, from, to },
    };
  } /**
   * Get webhook health status
   */
  @Get('health')
  getHealthStatus() {
    const healthStatus = this.webhookMonitoringService.getHealthStatus();
    const uptime = process.uptime();

    return {
      ...healthStatus,
      uptime: {
        seconds: Math.floor(uptime),
        human: this.formatUptime(uptime),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get alert configuration
   */
  @Get('alerts/config') getAlertConfiguration() {
    return {
      email: {
        enabled: this.configService.get<boolean>(
          'WEBHOOK_ALERTS_EMAIL_ENABLED',
          false,
        ),
        recipients: this.configService
          .get<string>('WEBHOOK_ALERTS_EMAIL_RECIPIENTS', '')
          .split(',')
          .filter((email) => email.trim().length > 0),
      },
      thresholds: {
        errorRate: {
          warning: 10,
          critical: 20,
        },
        processingTime: {
          warning: 3000,
          critical: 5000,
        },
        consecutiveFailures: {
          warning: 3,
          critical: 5,
        },
      },
    };
  }

  /**
   * Test alert system
   */
  @Post('alerts/test')
  @HttpCode(HttpStatus.OK)
  async testAlert(@Body() testData: TestAlertDto) {
    const alert = {
      type: testData.type,
      title: testData.title || 'Test Alert',
      message:
        testData.message || 'This is a test alert from the webhook dashboard.',
      metadata: {
        source: 'webhook-dashboard',
        triggeredBy: 'admin', // Replace with actual user when auth is available
      },
      timestamp: new Date(),
    };

    try {
      await this.webhookAlertService.sendAlert(alert);

      return {
        success: true,
        message: 'Test alert sent successfully',
        alert,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to send test alert',
        error: errorMessage,
        alert,
      };
    }
  }

  /**
   * Trigger manual cleanup
   */
  @Post('cleanup/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerManualCleanup(@Body() cleanupData?: { retentionDays?: number }) {
    try {
      const result = await this.webhookCleanupService.manualCleanup(
        cleanupData?.retentionDays,
      );

      return {
        success: true,
        message: 'Manual cleanup completed successfully',
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Manual cleanup failed',
        error: errorMessage,
      };
    }
  }
  /**
   * Get cleanup status and history
   */
  @Get('cleanup/status')
  getCleanupStatus() {
    return this.webhookCleanupService.getCleanupStatus();
  }

  /**
   * Reset webhook metrics (admin only)
   */
  @Post('metrics/reset')
  @HttpCode(HttpStatus.OK)
  resetMetrics() {
    this.webhookMonitoringService.resetMetrics();

    return {
      success: true,
      message: 'Webhook metrics reset successfully',
      resetAt: new Date().toISOString(),
    };
  }

  /**
   * Get system information
   */
  @Get('system')
  getSystemInfo() {
    return {
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch,
      webhook: {
        cleanupEnabled: true,
        retentionDays: this.configService.get<number>(
          'WEBHOOK_CLEANUP_RETENTION_DAYS',
          30,
        ),
        alertsConfigured: this.isAlertsConfigured(),
      },
      timestamps: {
        serverTime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  /**
   * Export webhook data for backup/analysis
   */
  @Get('export')
  async exportWebhookData(
    @Query('format') format: string = 'json',
    @Query('period') period: string = '7d',
  ) {
    const periodHours = this.parsePeriod(period);

    const [metrics, recentEvents] = await Promise.all([
      this.webhookMonitoringService.getDbMetrics(periodHours),
      this.webhookMonitoringService.getRecentEventsFromDb(1000),
    ]);

    const exportData = {
      exportInfo: {
        period: `${periodHours} hours`,
        format,
        exportedAt: new Date().toISOString(),
        eventCount: recentEvents.length,
      },
      metrics,
      events: recentEvents,
      configuration: this.getAlertConfiguration(),
    };

    if (format === 'csv') {
      // You could implement CSV export here
      return {
        message: 'CSV export not implemented yet',
        data: exportData,
      };
    }

    return exportData;
  }

  // Helper methods

  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([hdw])$/);
    if (!match) return 24; // Default to 24 hours

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h':
        return num;
      case 'd':
        return num * 24;
      case 'w':
        return num * 24 * 7;
      default:
        return 24;
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  private isAlertsConfigured(): boolean {
    return !!this.configService.get('WEBHOOK_ALERTS_EMAIL_ENABLED');
  }

  private async calculateTrends(periodHours: number) {
    // This is a simplified trend calculation
    // In a real implementation, you'd compare with previous periods
    const currentMetrics =
      await this.webhookMonitoringService.getDbMetrics(periodHours);

    return {
      successRate: {
        current:
          (currentMetrics.successfulEvents / currentMetrics.totalEvents) *
            100 || 0,
        trend: 'stable', // 'up', 'down', 'stable'
        change: 0, // percentage change
      },
      processingTime: {
        current: currentMetrics.averageProcessingTime,
        trend: 'stable',
        change: 0,
      },
      errorRate: {
        current: currentMetrics.errorRate,
        trend: 'stable',
        change: 0,
      },
    };
  }
  /**
   * Export webhook data to CSV format
   */
  @Get('export/csv')
  async exportCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'success' | 'failed',
    @Res() res?: Response,
  ) {
    try {
      // Get events from database (WebhookMonitoringService only accepts limit parameter)
      const events =
        await this.webhookMonitoringService.getRecentEventsFromDb(1000);

      // Filter events based on query parameters
      let filteredEvents = events;

      if (status) {
        filteredEvents = filteredEvents.filter((event) =>
          status === 'success' ? event.success : !event.success,
        );
      }

      if (startDate) {
        const start = new Date(startDate);
        filteredEvents = filteredEvents.filter(
          (event) => event.timestamp >= start,
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredEvents = filteredEvents.filter(
          (event) => event.timestamp <= end,
        );
      }

      // Generate CSV content
      const csvHeader = [
        'ID',
        'Order ID',
        'Response Code',
        'Processing Time (ms)',
        'Success',
        'Created At',
        'IP Address',
        'User Agent',
        'Error',
      ].join(',');

      const csvRows = filteredEvents.map((event) =>
        [
          event.id,
          event.orderId || '',
          event.responseCode || '',
          event.processingTime?.toString() || '',
          event.success ? 'true' : 'false',
          event.timestamp.toISOString(),
          event.ipAddress || '',
          `"${(event.userAgent || '').replace(/"/g, '""')}"`, // Escape quotes
          `"${(event.error || '').replace(/"/g, '""')}"`, // Escape quotes
        ].join(','),
      );

      const csvContent = [csvHeader, ...csvRows].join('\n');

      // Set response headers for CSV download
      const fileName = `webhook-events-${new Date().toISOString().split('T')[0]}.csv`;

      if (res) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        res.send(csvContent);
        return;
      }

      return {
        success: false,
        message: 'Response object not available',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to export CSV',
        error: errorMessage,
      };
    }
  }
  /**
   * Export webhook metrics to JSON format
   */
  @Get('export/json')
  async exportJson(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'success' | 'failed',
  ) {
    try {
      // Get events from database
      const events =
        await this.webhookMonitoringService.getRecentEventsFromDb(1000);

      // Filter events based on query parameters
      let filteredEvents = events;

      if (status) {
        filteredEvents = filteredEvents.filter((event) =>
          status === 'success' ? event.success : !event.success,
        );
      }

      if (startDate) {
        const start = new Date(startDate);
        filteredEvents = filteredEvents.filter(
          (event) => event.timestamp >= start,
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredEvents = filteredEvents.filter(
          (event) => event.timestamp <= end,
        );
      }

      const metrics = await this.webhookMonitoringService.getDbMetrics();

      return {
        success: true,
        exportedAt: new Date().toISOString(),
        filters: {
          startDate,
          endDate,
          status,
        },
        summary: {
          totalEvents: filteredEvents.length,
          metrics,
        },
        events: filteredEvents,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to export data',
        error: errorMessage,
      };
    }
  }
}
