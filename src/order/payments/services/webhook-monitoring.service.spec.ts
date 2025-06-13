import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  WebhookMonitoringService,
  WebhookEvent,
  WebhookMetrics,
} from './webhook-monitoring.service';

describe('WebhookMonitoringService', () => {
  let service: WebhookMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookMonitoringService],
    }).compile();

    service = module.get<WebhookMonitoringService>(WebhookMonitoringService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.resetMetrics();
  });

  describe('recordWebhookEvent', () => {
    it('should record successful webhook event', () => {
      const eventData = {
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 150,
        success: true,
      };

      service.recordWebhookEvent(eventData);

      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageProcessingTime).toBe(150);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.lastProcessedAt).toBeInstanceOf(Date);
    });

    it('should record failed webhook event', () => {
      const eventData = {
        orderId: 'ORDER123',
        responseCode: '09',
        processingTime: 200,
        success: false,
        error: 'Payment failed',
      };

      service.recordWebhookEvent(eventData);

      const metrics = service.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.averageProcessingTime).toBe(200);
      expect(metrics.errorRate).toBe(100);
    });

    it('should calculate average processing time correctly', () => {
      service.recordWebhookEvent({
        orderId: 'ORDER1',
        responseCode: '00',
        processingTime: 100,
        success: true,
      });

      service.recordWebhookEvent({
        orderId: 'ORDER2',
        responseCode: '00',
        processingTime: 200,
        success: true,
      });

      service.recordWebhookEvent({
        orderId: 'ORDER3',
        responseCode: '00',
        processingTime: 300,
        success: true,
      });

      const metrics = service.getMetrics();
      expect(metrics.averageProcessingTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should calculate error rate correctly', () => {
      // Record 7 successful and 3 failed events
      for (let i = 0; i < 7; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      for (let i = 0; i < 3; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 150,
          success: false,
          error: 'Test error',
        });
      }

      const metrics = service.getMetrics();
      expect(metrics.errorRate).toBe(30); // 3 failures out of 10 total = 30%
    });

    it('should maintain event history limit', () => {
      // Record more than maxEvents (1000) to test limit
      for (let i = 0; i < 1100; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      const recentEvents = service.getRecentEvents(2000);
      expect(recentEvents.length).toBe(1000); // Should be limited to maxEvents
    });

    it('should assign unique IDs and timestamps', () => {
      service.recordWebhookEvent({
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 150,
        success: true,
      });

      service.recordWebhookEvent({
        orderId: 'ORDER456',
        responseCode: '00',
        processingTime: 150,
        success: true,
      });

      const events = service.getRecentEvents(2);
      expect(events[0].id).toBeDefined();
      expect(events[1].id).toBeDefined();
      expect(events[0].id).not.toBe(events[1].id);
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[1].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
        errorRate: 0,
      });
    });

    it('should return copy of metrics (not reference)', () => {
      const metrics1 = service.getMetrics();
      const metrics2 = service.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('getRecentEvents', () => {
    beforeEach(() => {
      // Add some test events
      for (let i = 0; i < 5; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }
    });

    it('should return recent events with default limit', () => {
      const events = service.getRecentEvents();
      expect(events.length).toBe(5);
    });

    it('should return limited number of events', () => {
      const events = service.getRecentEvents(3);
      expect(events.length).toBe(3);
    });

    it('should return events in reverse chronological order', () => {
      const events = service.getRecentEvents();
      expect(events[0].orderId).toBe('ORDER4'); // Most recent first
      expect(events[4].orderId).toBe('ORDER0'); // Oldest last
    });
  });

  describe('getEventsByOrderId', () => {
    beforeEach(() => {
      service.recordWebhookEvent({
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 150,
        success: true,
      });

      service.recordWebhookEvent({
        orderId: 'ORDER456',
        responseCode: '09',
        processingTime: 200,
        success: false,
        error: 'Payment failed',
      });

      service.recordWebhookEvent({
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 180,
        success: true,
      });
    });

    it('should return events for specific order', () => {
      const events = service.getEventsByOrderId('ORDER123');
      expect(events.length).toBe(2);
      expect(events.every((e) => e.orderId === 'ORDER123')).toBe(true);
    });

    it('should return empty array for non-existent order', () => {
      const events = service.getEventsByOrderId('NON_EXISTENT');
      expect(events).toEqual([]);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for good metrics', () => {
      // Record successful events
      for (let i = 0; i < 10; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      const health = service.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.issues).toEqual([]);
    });

    it('should return warning status for elevated error rate', () => {
      // Record mixed success/failure events (15% error rate)
      for (let i = 0; i < 17; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      for (let i = 0; i < 3; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 150,
          success: false,
          error: 'Test error',
        });
      }

      const health = service.getHealthStatus();
      expect(health.status).toBe('warning');
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain('Elevated error rate');
    });

    it('should return critical status for high error rate', () => {
      // Record events with 25% error rate
      for (let i = 0; i < 15; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      for (let i = 0; i < 5; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 150,
          success: false,
          error: 'Test error',
        });
      }

      const health = service.getHealthStatus();
      expect(health.status).toBe('critical');
      expect(
        health.issues.some((issue) => issue.includes('High error rate')),
      ).toBe(true);
    });

    it('should return warning for slow processing', () => {
      // Record events with slow processing time
      for (let i = 0; i < 5; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 4000, // 4 seconds - slow but not critical
          success: true,
        });
      }

      const health = service.getHealthStatus();
      expect(health.status).toBe('warning');
      expect(
        health.issues.some((issue) => issue.includes('Slow processing')),
      ).toBe(true);
    });

    it('should return critical status for consecutive failures', () => {
      // Record 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 150,
          success: false,
          error: 'Test error',
        });
      }

      const health = service.getHealthStatus();
      expect(health.status).toBe('critical');
      expect(
        health.issues.some((issue) =>
          issue.includes('Multiple recent failures'),
        ),
      ).toBe(true);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics and events', () => {
      // Record some events
      service.recordWebhookEvent({
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 150,
        success: true,
      });

      service.recordWebhookEvent({
        orderId: 'ORDER456',
        responseCode: '09',
        processingTime: 200,
        success: false,
        error: 'Test error',
      });

      // Reset metrics
      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
        errorRate: 0,
      });

      const events = service.getRecentEvents();
      expect(events).toEqual([]);
    });
  });

  describe('getPerformanceSummary', () => {
    beforeEach(() => {
      const now = new Date();

      // Record events within the time period
      for (let i = 0; i < 8; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 100 + i * 50, // Varying processing times
          success: true,
        });
      }

      // Record 2 failed events
      for (let i = 0; i < 2; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 200,
          success: false,
          error: 'Payment failed',
        });
      }
    });

    it('should return performance summary for default period', () => {
      const summary = service.getPerformanceSummary();

      expect(summary.period).toBe('60 minutes');
      expect(summary.totalEvents).toBe(10);
      expect(summary.successRate).toBe(80); // 8 success out of 10
      expect(summary.averageTime).toBeGreaterThan(0);
      expect(summary.peakTime).toBeGreaterThan(0);
      expect(summary.errorCounts).toHaveProperty('Payment failed');
    });

    it('should return performance summary for custom period', () => {
      const summary = service.getPerformanceSummary(30);

      expect(summary.period).toBe('30 minutes');
      expect(summary.totalEvents).toBe(10); // All events are recent
    });

    it('should handle empty event history', () => {
      service.resetMetrics();
      const summary = service.getPerformanceSummary();

      expect(summary.totalEvents).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.averageTime).toBe(0);
      expect(summary.peakTime).toBe(0);
      expect(Object.keys(summary.errorCounts)).toHaveLength(0);
    });
  });

  describe('performance threshold alerts', () => {
    it('should log warning for slow processing', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'warn');

      service.recordWebhookEvent({
        orderId: 'ORDER123',
        responseCode: '00',
        processingTime: 6000, // 6 seconds - exceeds 5s threshold
        success: true,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow webhook processing detected'),
      );
    });

    it('should log warning for high error rate', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'warn');

      // Create scenario with >10% error rate
      for (let i = 0; i < 10; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER${i}`,
          responseCode: '00',
          processingTime: 150,
          success: true,
        });
      }

      // Add 2 more failures to exceed 10% threshold
      service.recordWebhookEvent({
        orderId: 'ORDER_FAIL1',
        responseCode: '09',
        processingTime: 150,
        success: false,
        error: 'Test error',
      });

      service.recordWebhookEvent({
        orderId: 'ORDER_FAIL2',
        responseCode: '09',
        processingTime: 150,
        success: false,
        error: 'Test error',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('High webhook error rate detected'),
      );
    });

    it('should log error for consecutive failures', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'error');

      // Record 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        service.recordWebhookEvent({
          orderId: `ORDER_FAIL${i}`,
          responseCode: '09',
          processingTime: 150,
          success: false,
          error: 'Test error',
        });
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Multiple consecutive webhook failures detected',
        ),
      );
    });
  });
});
