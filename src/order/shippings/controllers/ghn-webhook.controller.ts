import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Headers,
  RawBodyRequest,
  Req,
  UseFilters,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ShippingService } from '../shipping.service';
import { ResponseMessage } from 'src/common/decorators';
import { OrderExceptionFilter } from '../../filters/order-exception.filter';

interface GHNWebhookData {
  order_code: string;
  status: string;
  updated_date: string;
  description: string;
}

@Controller('webhooks/ghn')
@UseFilters(OrderExceptionFilter)
export class GHNWebhookController {
  private readonly logger = new Logger(GHNWebhookController.name);

  constructor(
    private readonly shippingService: ShippingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verify GHN webhook signature
   */
  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('GHN_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.warn(
        'GHN_WEBHOOK_SECRET not configured, skipping signature verification',
      );
      return true; // Allow webhook if secret not configured (for development)
    }

    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }
  @Post('status-update')
  @ResponseMessage('GHN webhook processed successfully')
  @HttpCode(HttpStatus.OK)
  async handleStatusUpdate(
    @Body() webhookData: GHNWebhookData,
    @Headers('x-ghn-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      this.logger.log(
        `Received GHN webhook for order: ${webhookData.order_code}, status: ${webhookData.status}`,
      );

      // Verify webhook signature for security
      if (signature) {
        const rawBody = req.rawBody?.toString() || JSON.stringify(webhookData);
        const isValidSignature = this.verifyWebhookSignature(
          rawBody,
          signature,
        );

        if (!isValidSignature) {
          this.logger.error('Invalid GHN webhook signature');
          throw new BadRequestException('Invalid webhook signature');
        }
      }

      if (!webhookData.order_code || !webhookData.status) {
        throw new BadRequestException('Missing required webhook data');
      }

      // Update shipping status based on GHN webhook
      await this.shippingService.updateFromGHNTracking(webhookData.order_code);

      this.logger.log(
        `Successfully processed GHN webhook for order: ${webhookData.order_code}`,
      );

      return { processed: true };
    } catch (error) {
      this.logger.error(
        `Failed to process GHN webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );

      // Return success to GHN to avoid retry loops, but log the error
      return { processed: false, acknowledged: true };
    }
  }
}
