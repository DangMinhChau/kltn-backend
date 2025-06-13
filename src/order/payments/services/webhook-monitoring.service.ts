import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { WebhookEvent as WebhookEventEntity } from '../entities/webhook-event.entity';
import { WebhookAlertService } from './webhook-alert.service';

export interface WebhookMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  lastProcessedAt: Date | null;
  errorRate: number;
}

export interface WebhookEvent {
  id: string;
  orderId: string;
  responseCode: string;
  processingTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface WebhookEventCreateDto {
  orderId: string;
  responseCode: string;
  processingTime: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  webhookId?: string;
}

@Injectable()
export class WebhookMonitoringService {
  private readonly logger = new Logger(WebhookMonitoringService.name);
  constructor(
    @InjectRepository(WebhookEventEntity)
    private readonly webhookEventRepository: Repository<WebhookEventEntity>,
    private readonly alertService: WebhookAlertService,
  ) {}

  private metrics: WebhookMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    lastProcessedAt: null,
    errorRate: 0,
  };

  private recentEvents: WebhookEvent[] = [];
  private readonly maxEvents = 1000; // Keep last 1000 events in memory

  /**
   * Record webhook event to both database and memory
   */
  async recordWebhookEvent(event: WebhookEventCreateDto): Promise<void> {
    const webhookEvent: WebhookEvent = {
      id: `${event.orderId}-${Date.now()}`,
      timestamp: new Date(),
      orderId: event.orderId,
      responseCode: event.responseCode,
      processingTime: event.processingTime,
      success: event.success,
      error: event.error,
    };

    try {
      // Save to database
      await this.webhookEventRepository.save({
        orderId: event.orderId,
        responseCode: event.responseCode,
        processingTime: event.processingTime,
        success: event.success,
        error: event.error,
        metadata: event.metadata,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        webhookId: event.webhookId,
        timestamp: webhookEvent.timestamp,
      });
    } catch (dbError) {
      this.logger.error('Failed to save webhook event to database:', dbError);
      // Continue with in-memory processing even if DB fails
    }

    // Add to recent events (in-memory cache)
    this.recentEvents.unshift(webhookEvent);
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxEvents);
    }

    // Update metrics
    this.updateMetrics(webhookEvent);

    // Log event
    if (event.success) {
      this.logger.log(
        `Webhook processed successfully: ${event.orderId} (${event.processingTime}ms)`,
      );
    } else {
      this.logger.error(
        `Webhook processing failed: ${event.orderId} - ${event.error}`,
      );
    } // Check for performance issues
    await this.checkPerformanceThresholds(webhookEvent);
  }

  /**
   * Update metrics with new event
   */
  private updateMetrics(event: WebhookEvent): void {
    this.metrics.totalRequests++;
    this.metrics.lastProcessedAt = event.timestamp;

    if (event.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Calculate average processing time
    const totalTime =
      this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1) +
      event.processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalRequests;

    // Calculate error rate
    this.metrics.errorRate =
      (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
  }
  /**
   * Check performance thresholds and alert if necessary
   */
  private async checkPerformanceThresholds(event: WebhookEvent): Promise<void> {
    // Alert on slow processing
    if (event.processingTime > 5000) {
      this.logger.warn(
        `Slow webhook processing detected: ${event.orderId} took ${event.processingTime}ms`,
      );

      // Send slow processing alert
      try {
        const alert = this.alertService.createSlowProcessingAlert(
          event.processingTime,
          event.orderId,
        );
        await this.alertService.sendAlert(alert);
      } catch (alertError) {
        this.logger.error('Failed to send slow processing alert:', alertError);
      }
    }

    // Alert on high error rate
    if (this.metrics.errorRate > 10 && this.metrics.totalRequests > 10) {
      this.logger.warn(
        `High webhook error rate detected: ${this.metrics.errorRate.toFixed(2)}%`,
      );

      // Send high error rate alert
      try {
        const alert = this.alertService.createHighErrorRateAlert(
          this.metrics.errorRate,
          this.metrics.totalRequests,
        );
        await this.alertService.sendAlert(alert);
      } catch (alertError) {
        this.logger.error('Failed to send high error rate alert:', alertError);
      }
    }

    // Alert on consecutive failures
    const recentFailures = this.recentEvents
      .slice(0, 10)
      .filter((e) => !e.success);
    if (recentFailures.length >= 3) {
      this.logger.error(
        `Multiple consecutive webhook failures detected: ${recentFailures.length} out of last 10`,
      );

      // Send consecutive failures alert
      try {
        const alert = this.alertService.createConsecutiveFailuresAlert(
          recentFailures.length,
          10,
        );
        await this.alertService.sendAlert(alert);
      } catch (alertError) {
        this.logger.error(
          'Failed to send consecutive failures alert:',
          alertError,
        );
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebhookMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): WebhookEvent[] {
    return this.recentEvents.slice(0, limit);
  }

  /**
   * Get events for specific order
   */
  getEventsByOrderId(orderId: string): WebhookEvent[] {
    return this.recentEvents.filter((event) => event.orderId === orderId);
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: WebhookMetrics;
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check error rate
    if (this.metrics.errorRate > 20) {
      issues.push(`High error rate: ${this.metrics.errorRate.toFixed(2)}%`);
      status = 'critical';
    } else if (this.metrics.errorRate > 10) {
      issues.push(`Elevated error rate: ${this.metrics.errorRate.toFixed(2)}%`);
      if (status === 'healthy') status = 'warning';
    }

    // Check processing time
    if (this.metrics.averageProcessingTime > 3000) {
      issues.push(
        `Slow processing: ${this.metrics.averageProcessingTime.toFixed(0)}ms average`,
      );
      if (status === 'healthy') status = 'warning';
    }

    // Check recent activity
    const lastProcessed = this.metrics.lastProcessedAt;
    if (lastProcessed) {
      const timeSinceLastWebhook = Date.now() - lastProcessed.getTime();
      if (timeSinceLastWebhook > 300000) {
        // 5 minutes
        issues.push(
          `No recent webhook activity: ${Math.round(timeSinceLastWebhook / 60000)} minutes ago`,
        );
        if (status === 'healthy') status = 'warning';
      }
    }

    // Check consecutive failures
    const recentFailures = this.recentEvents
      .slice(0, 10)
      .filter((e) => !e.success);
    if (recentFailures.length >= 5) {
      issues.push(
        `Multiple recent failures: ${recentFailures.length} out of last 10`,
      );
      status = 'critical';
    }

    return {
      status,
      issues,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null,
      errorRate: 0,
    };
    this.recentEvents = [];
    this.logger.log('Webhook metrics reset');
  }
  /**
   * Get recent events from database
   */
  async getRecentEventsFromDb(
    limit: number = 50,
  ): Promise<WebhookEventEntity[]> {
    return await this.webhookEventRepository.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get events for specific order from database
   */
  async getEventsByOrderIdFromDb(
    orderId: string,
  ): Promise<WebhookEventEntity[]> {
    return await this.webhookEventRepository.find({
      where: { orderId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get webhook statistics from database for specified time period
   */
  async getDbMetrics(periodHours: number = 24): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    averageProcessingTime: number;
    errorRate: number;
    lastProcessedAt: Date | null;
  }> {
    const cutoff = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    const events = await this.webhookEventRepository.find({
      where: { timestamp: Between(cutoff, new Date()) },
    });

    const successfulEvents = events.filter((e) => e.success);
    const failedEvents = events.filter((e) => !e.success);

    const totalProcessingTime = events.reduce(
      (sum, e) => sum + e.processingTime,
      0,
    );
    const averageProcessingTime =
      events.length > 0 ? totalProcessingTime / events.length : 0;

    const lastEvent = await this.webhookEventRepository.findOne({
      order: { timestamp: 'DESC' },
    });

    return {
      totalEvents: events.length,
      successfulEvents: successfulEvents.length,
      failedEvents: failedEvents.length,
      averageProcessingTime: Math.round(averageProcessingTime),
      errorRate:
        events.length > 0 ? (failedEvents.length / events.length) * 100 : 0,
      lastProcessedAt: lastEvent?.timestamp || null,
    };
  }

  /**
   * Clean up old webhook events (retention policy)
   */
  async cleanupOldEvents(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.webhookEventRepository.delete({
      timestamp: LessThan(cutoff),
    });

    const deletedCount = result.affected || 0;
    this.logger.log(
      `Cleaned up ${deletedCount} webhook events older than ${retentionDays} days`,
    );

    return deletedCount;
  }

  /**
   * Get performance summary for time period
   */
  getPerformanceSummary(periodMinutes: number = 60): {
    period: string;
    totalEvents: number;
    successRate: number;
    averageTime: number;
    peakTime: number;
    errorCounts: Record<string, number>;
  } {
    const cutoff = new Date(Date.now() - periodMinutes * 60 * 1000);
    const periodEvents = this.recentEvents.filter(
      (event) => event.timestamp > cutoff,
    );

    const successfulEvents = periodEvents.filter((e) => e.success);
    const errorCounts: Record<string, number> = {};

    // Count error types
    periodEvents
      .filter((e) => !e.success)
      .forEach((e) => {
        const errorKey = e.error || 'Unknown Error';
        errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
      });

    // Calculate stats
    const processingTimes = periodEvents.map((e) => e.processingTime);
    const averageTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;
    const peakTime =
      processingTimes.length > 0 ? Math.max(...processingTimes) : 0;

    return {
      period: `${periodMinutes} minutes`,
      totalEvents: periodEvents.length,
      successRate:
        periodEvents.length > 0
          ? (successfulEvents.length / periodEvents.length) * 100
          : 0,
      averageTime: Math.round(averageTime),
      peakTime,
      errorCounts,
    };
  }
}
