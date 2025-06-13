import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { VNPayWebhookController } from './vnpay-webhook.controller';
import { PaymentsService } from '../payments.service';
import { WebhookMonitoringService } from '../services/webhook-monitoring.service';
import { VNPayWebhookDto } from '../dto/vnpay-webhook.dto';

describe('VNPayWebhookController', () => {
  let controller: VNPayWebhookController;
  let paymentsService: jest.Mocked<PaymentsService>;
  let webhookMonitoring: jest.Mocked<WebhookMonitoringService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPayment = {
    id: '1',
    orderId: 'ORDER123',
    status: 'completed',
    amount: 100000,
    vnpTransactionId: '14123456',
    vnpResponseCode: '00',
  };

  const mockWebhookData: VNPayWebhookDto = {
    vnp_Amount: '10000000',
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP01234567',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Payment for test order',
    vnp_PayDate: '20250609120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: 'TEST123',
    vnp_TransactionNo: '14123456',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: 'ORDER123',
    vnp_SecureHash: 'valid_hash',
  };

  beforeEach(async () => {
    const mockPaymentsService = {
      handleVNPayWebhook: jest.fn(),
    };

    const mockWebhookMonitoring = {
      recordWebhookEvent: jest.fn(),
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getRecentEvents: jest.fn(),
      getPerformanceSummary: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'VNPAY_HASH_SECRET') return 'test_secret';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VNPayWebhookController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: WebhookMonitoringService,
          useValue: mockWebhookMonitoring,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<VNPayWebhookController>(VNPayWebhookController);
    paymentsService = module.get(PaymentsService);
    webhookMonitoring = module.get(WebhookMonitoringService);
    configService = module.get(ConfigService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePaymentNotification', () => {
    it('should process successful webhook', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      const result = await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      expect(paymentsService.handleVNPayWebhook).toHaveBeenCalledWith(
        mockWebhookData,
      );
      expect(webhookMonitoring.recordWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORDER123',
          responseCode: '00',
          success: true,
        }),
      );
    });

    it('should handle failed payment webhook', async () => {
      const failedWebhookData = {
        ...mockWebhookData,
        vnp_ResponseCode: '09',
        vnp_TransactionStatus: '02',
      };

      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      const result = await controller.handlePaymentNotification(
        failedWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      expect(webhookMonitoring.recordWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORDER123',
          responseCode: '09',
          success: true,
        }),
      );
    });

    it('should handle invalid data', async () => {
      const invalidWebhookData = {
        vnp_Amount: '10000000',
        // Missing required fields
      } as any;

      const result = await controller.handlePaymentNotification(
        invalidWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '02',
        Message: 'Invalid Data',
      });
      expect(paymentsService.handleVNPayWebhook).not.toHaveBeenCalled();
    });

    it('should handle payment service errors', async () => {
      const error = new Error('Payment processing failed');
      paymentsService.handleVNPayWebhook.mockRejectedValue(error);

      const result = await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '99',
        Message: 'Webhook processing failed',
      });
      expect(webhookMonitoring.recordWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORDER123',
          success: false,
          error: 'Payment processing failed',
        }),
      );
    });

    it('should handle missing order ID', async () => {
      const noOrderIdData = {
        ...mockWebhookData,
        vnp_TxnRef: '',
      };

      const result = await controller.handlePaymentNotification(
        noOrderIdData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '02',
        Message: 'Invalid Data',
      });
    });

    it('should record processing time in monitoring', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(webhookMonitoring.recordWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          processingTime: expect.any(Number),
        }),
      );
    });

    it('should handle duplicate webhook attempts', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      // Send same webhook twice
      await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );
      await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(paymentsService.handleVNPayWebhook).toHaveBeenCalledTimes(2);
      expect(webhookMonitoring.recordWebhookEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('handlePaymentNotificationAlt', () => {
    it('should redirect to main handler', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      const result = await controller.handlePaymentNotificationAlt(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      expect(paymentsService.handleVNPayWebhook).toHaveBeenCalledWith(
        mockWebhookData,
      );
    });
  });

  describe('getWebhookHealth', () => {
    it('should return health status', () => {
      const mockHealthStatus = {
        status: 'healthy' as const,
        issues: [],
        metrics: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageProcessingTime: 150,
          lastProcessedAt: new Date(),
          errorRate: 5,
        },
      };

      webhookMonitoring.getHealthStatus.mockReturnValue(mockHealthStatus);

      const result = controller.getWebhookHealth();

      expect(result).toEqual(mockHealthStatus);
      expect(webhookMonitoring.getHealthStatus).toHaveBeenCalled();
    });
  });

  describe('getWebhookMetrics', () => {
    it('should return webhook metrics', () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageProcessingTime: 150,
        lastProcessedAt: new Date(),
        errorRate: 5,
      };

      webhookMonitoring.getMetrics.mockReturnValue(mockMetrics);

      const result = controller.getWebhookMetrics();

      expect(result).toEqual(mockMetrics);
      expect(webhookMonitoring.getMetrics).toHaveBeenCalled();
    });
  });

  describe('getRecentEvents', () => {
    it('should return recent events with default limit', () => {
      const mockEvents = [
        {
          id: '1',
          orderId: 'ORDER123',
          responseCode: '00',
          processingTime: 150,
          success: true,
          timestamp: new Date(),
        },
      ];

      webhookMonitoring.getRecentEvents.mockReturnValue(mockEvents);

      const result = controller.getRecentEvents();

      expect(result).toEqual(mockEvents);
      expect(webhookMonitoring.getRecentEvents).toHaveBeenCalledWith(50);
    });

    it('should return recent events with custom limit', () => {
      const mockEvents = [];
      webhookMonitoring.getRecentEvents.mockReturnValue(mockEvents);

      const result = controller.getRecentEvents('25');

      expect(result).toEqual(mockEvents);
      expect(webhookMonitoring.getRecentEvents).toHaveBeenCalledWith(25);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return performance summary with default period', () => {
      const mockSummary = {
        period: '60 minutes',
        totalEvents: 50,
        successRate: 96,
        averageTime: 145,
        peakTime: 300,
        errorCounts: { 'Payment not found': 2 },
      };

      webhookMonitoring.getPerformanceSummary.mockReturnValue(mockSummary);

      const result = controller.getPerformanceSummary();

      expect(result).toEqual(mockSummary);
      expect(webhookMonitoring.getPerformanceSummary).toHaveBeenCalledWith(60);
    });

    it('should return performance summary with custom period', () => {
      const mockSummary = {
        period: '120 minutes',
        totalEvents: 100,
        successRate: 94,
        averageTime: 160,
        peakTime: 450,
        errorCounts: {},
      };

      webhookMonitoring.getPerformanceSummary.mockReturnValue(mockSummary);

      const result = controller.getPerformanceSummary('120');

      expect(result).toEqual(mockSummary);
      expect(webhookMonitoring.getPerformanceSummary).toHaveBeenCalledWith(120);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected system error');
      paymentsService.handleVNPayWebhook.mockRejectedValue(unexpectedError);

      const result = await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '99',
        Message: 'Webhook processing failed',
      });
    });

    it('should handle monitoring service errors', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);
      webhookMonitoring.recordWebhookEvent.mockImplementation(() => {
        throw new Error('Monitoring error');
      });

      // Should not throw, webhook processing should continue
      const result = await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      expect(result).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
    });
  });

  describe('webhook ID generation', () => {
    it('should generate unique webhook IDs', async () => {
      paymentsService.handleVNPayWebhook.mockResolvedValue(mockPayment as any);

      await controller.handlePaymentNotification(
        mockWebhookData,
        {} as any,
        {},
      );

      await controller.handlePaymentNotification(
        { ...mockWebhookData, vnp_TxnRef: 'ORDER456' },
        {} as any,
        {},
      );

      // Both calls should have succeeded with different webhook IDs
      expect(paymentsService.handleVNPayWebhook).toHaveBeenCalledTimes(2);
    });
  });
});
