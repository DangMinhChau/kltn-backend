import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  RawBodyRequest,
  Req,
  UseFilters,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentsService } from '../payments.service';
import { WebhookMonitoringService } from '../services/webhook-monitoring.service';
import { ResponseMessage } from 'src/common/decorators';
import { OrderExceptionFilter } from '../../filters/order-exception.filter';
import { VNPayWebhookDto } from '../dto/vnpay-webhook.dto';

@ApiTags('Internal - Webhooks')
@ApiExcludeController()
@Controller('webhooks/vnpay')
@UseFilters(OrderExceptionFilter)
export class VNPayWebhookController {
  private readonly logger = new Logger(VNPayWebhookController.name);
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly webhookMonitoring: WebhookMonitoringService,
  ) {}

  /**
   * Verify VNPay webhook signature
   */
  private verifyWebhookSignature(
    params: Record<string, string>,
    secureHash: string,
  ): boolean {
    const vnpHashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');

    if (!vnpHashSecret) {
      this.logger.warn(
        'VNPAY_HASH_SECRET not configured, skipping signature verification',
      );
      return true; // Allow webhook if secret not configured (for development)
    }

    try {
      // Remove hash from params for verification
      const paramsWithoutHash: Record<string, string> = {};
      Object.keys(params).forEach((key) => {
        if (key !== 'vnp_SecureHash') {
          paramsWithoutHash[key] = params[key];
        }
      });

      // Sort params and create signature
      const sortedParams: Record<string, string> = {};
      Object.keys(paramsWithoutHash)
        .sort()
        .forEach((key) => {
          sortedParams[key] = paramsWithoutHash[key];
        });

      const signData = new URLSearchParams(sortedParams).toString();
      const hmac = createHmac('sha512', vnpHashSecret);
      const expectedSignature = hmac
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      return expectedSignature === secureHash;
    } catch (error) {
      this.logger.error('Error verifying VNPay webhook signature:', error);
      return false;
    }
  }
  /**
   * Handle VNPay IPN (Instant Payment Notification) webhook
   */
  @Post('ipn')
  @ResponseMessage('VNPay webhook processed successfully')
  @HttpCode(HttpStatus.OK)
  async handlePaymentNotification(
    @Body() webhookData: VNPayWebhookDto,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    const startTime = Date.now();
    const webhookId = `${webhookData.vnp_TxnRef}-${Date.now()}`;

    try {
      this.logger.log(
        `[${webhookId}] Received VNPay webhook for transaction: ${webhookData.vnp_TxnRef}, ` +
          `status: ${webhookData.vnp_TransactionStatus}, ` +
          `response: ${webhookData.vnp_ResponseCode}, ` +
          `IP: ${req.ip || 'unknown'}`,
      );

      // Log webhook payload for debugging (without sensitive data)
      this.logger.debug(`[${webhookId}] Webhook headers:`, {
        userAgent: headers['user-agent'],
        contentType: headers['content-type'],
        contentLength: headers['content-length'],
      });

      // Convert webhook data to params object for signature verification
      const params: Record<string, string> = {};
      Object.keys(webhookData).forEach((key) => {
        const value = webhookData[key as keyof VNPayWebhookDto];
        if (value !== undefined) {
          params[key] = String(value);
        }
      });

      // Verify webhook signature for security
      const secureHash = webhookData.vnp_SecureHash;
      if (secureHash) {
        const isValidSignature = this.verifyWebhookSignature(
          params,
          secureHash,
        );

        if (!isValidSignature) {
          this.logger.error(`[${webhookId}] Invalid VNPay webhook signature`);
          return { RspCode: '97', Message: 'Invalid Signature' };
        }

        this.logger.debug(
          `[${webhookId}] Webhook signature verified successfully`,
        );
      }

      // Validate required webhook data
      if (!webhookData.vnp_TxnRef || !webhookData.vnp_TransactionStatus) {
        this.logger.error(`[${webhookId}] Missing required VNPay webhook data`);
        return { RspCode: '02', Message: 'Invalid Data' };
      }

      // Log processing start
      this.logger.log(
        `[${webhookId}] Processing webhook for order: ${webhookData.vnp_TxnRef}`,
      );

      // Process the webhook
      const result = await this.paymentsService.handleVNPayWebhook(webhookData);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `[${webhookId}] Successfully processed VNPay webhook for transaction: ${webhookData.vnp_TxnRef} ` +
          `in ${processingTime}ms`,
      ); // Log success metrics
      this.logger.debug(
        `[${webhookId}] Payment status updated to: ${result.status}`,
      ); // Return success response in VNPay expected format
      await this.webhookMonitoring.recordWebhookEvent({
        orderId: webhookData.vnp_TxnRef,
        responseCode: webhookData.vnp_ResponseCode,
        processingTime,
        success: true,
        metadata: {
          bankCode: webhookData.vnp_BankCode,
          bankTranNo: webhookData.vnp_BankTranNo,
          cardType: webhookData.vnp_CardType,
          payDate: webhookData.vnp_PayDate,
          transactionNo: webhookData.vnp_TransactionNo,
          transactionStatus: webhookData.vnp_TransactionStatus,
          amount: webhookData.vnp_Amount,
        },
        ipAddress: req.ip,
        userAgent: headers['user-agent'],
        webhookId,
      });

      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `[${webhookId}] Failed to process VNPay webhook after ${processingTime}ms: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );

      // Log error details for monitoring
      if (error instanceof Error) {
        this.logger.error(`[${webhookId}] Error details:`, {
          errorName: error.name,
          errorMessage: error.message,
          orderId: webhookData.vnp_TxnRef,
          responseCode: webhookData.vnp_ResponseCode,
          transactionStatus: webhookData.vnp_TransactionStatus,
        });
      } // Record failed webhook event
      await this.webhookMonitoring.recordWebhookEvent({
        orderId: webhookData.vnp_TxnRef,
        responseCode: webhookData.vnp_ResponseCode,
        processingTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          bankCode: webhookData.vnp_BankCode,
          bankTranNo: webhookData.vnp_BankTranNo,
          cardType: webhookData.vnp_CardType,
          payDate: webhookData.vnp_PayDate,
          transactionNo: webhookData.vnp_TransactionNo,
          transactionStatus: webhookData.vnp_TransactionStatus,
          amount: webhookData.vnp_Amount,
        },
        ipAddress: req.ip,
        userAgent: headers['user-agent'],
        webhookId,
      });

      // Return failure response to VNPay to trigger retry
      return { RspCode: '99', Message: 'Webhook processing failed' };
    }
  }
  /**
   * Alternative endpoint for VNPay webhook (some integrations use different paths)
   */
  @Post('notify')
  @ResponseMessage('VNPay notification processed successfully')
  @HttpCode(HttpStatus.OK)
  async handlePaymentNotificationAlt(
    @Body() webhookData: VNPayWebhookDto,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(
      `Redirecting VNPay notification from /notify to main handler`,
    );
    return this.handlePaymentNotification(webhookData, req, headers);
  }

  /**
   * Get webhook health status
   */
  @Get('health')
  @ResponseMessage('Webhook health status retrieved')
  getWebhookHealth() {
    return this.webhookMonitoring.getHealthStatus();
  }

  /**
   * Get webhook metrics
   */
  @Get('metrics')
  @ResponseMessage('Webhook metrics retrieved')
  getWebhookMetrics() {
    return this.webhookMonitoring.getMetrics();
  }

  /**
   * Get recent webhook events
   */
  @Get('events')
  @ResponseMessage('Recent webhook events retrieved')
  getRecentEvents(@Query('limit') limit?: string) {
    const eventLimit = limit ? parseInt(limit, 10) : 50;
    return this.webhookMonitoring.getRecentEvents(eventLimit);
  }

  /**
   * Get performance summary
   */
  @Get('performance')
  @ResponseMessage('Webhook performance summary retrieved')
  getPerformanceSummary(@Query('period') period?: string) {
    const periodMinutes = period ? parseInt(period, 10) : 60;
    return this.webhookMonitoring.getPerformanceSummary(periodMinutes);
  }
}
