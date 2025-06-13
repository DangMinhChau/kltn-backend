import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../../common/services/mail/mail.service';

export interface AlertConfig {
  email: {
    enabled: boolean;
    recipients: string[];
  };
}

export interface Alert {
  type: 'error' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class WebhookAlertService {
  private readonly logger = new Logger(WebhookAlertService.name);
  private readonly alertConfig: AlertConfig;
  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.alertConfig = {
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
    };
  }
  /**
   * Send alert through email
   */
  async sendAlert(alert: Alert): Promise<void> {
    this.logger.log(`Sending ${alert.type} alert: ${alert.title}`);

    if (
      this.alertConfig?.email?.enabled &&
      this.alertConfig?.email?.recipients &&
      this.alertConfig.email.recipients.length > 0
    ) {
      try {
        await this.sendEmailAlert(alert);
        this.logger.log('Email alert sent successfully');
      } catch (error) {
        this.logger.error('Failed to send email alert:', error);
        throw error;
      }
    } else {
      this.logger.warn(
        'Email alerts are not enabled or no recipients configured',
      );
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    try {
      const subject = `[${alert.type.toUpperCase()}] Webhook Alert: ${alert.title}`;
      const html = this.generateEmailHtml(alert);
      for (const recipient of this.alertConfig?.email?.recipients || []) {
        await this.mailService.sendMail({
          to: recipient,
          subject,
          html,
          text: alert.message, // text fallback
        });
      }
      this.logger.log(
        `Email alert sent to ${this.alertConfig?.email?.recipients?.length || 0} recipients`,
      );
    } catch (error) {
      this.logger.error('Failed to send email alert:', error);
      throw error;
    }
  }
  /**
   * Generate HTML for email alerts
   */
  private generateEmailHtml(alert: Alert): string {
    const alertColor = this.getAlertColor(alert.type);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .alert-container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert-header { background: ${alertColor}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .alert-body { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; }
            .metadata { background: white; padding: 10px; margin-top: 15px; border-radius: 3px; }
            .metadata-item { margin: 5px 0; }
            .timestamp { color: #666; font-size: 0.9em; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="alert-container">
            <div class="alert-header">
              <h2>${alert.type.toUpperCase()} ALERT: ${alert.title}</h2>
            </div>
            <div class="alert-body">
              <p>${alert.message}</p>
              
              ${
                alert.metadata
                  ? `
                <div class="metadata">
                  <h4>Additional Information:</h4>
                  ${Object.entries(alert.metadata)
                    .map(
                      ([key, value]) => `
                      <div class="metadata-item">
                        <strong>${key}:</strong> ${value}
                      </div>
                    `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
              
              <div class="timestamp">
                Alert generated at: ${alert.timestamp.toISOString()}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get alert color based on type
   */
  private getAlertColor(type: Alert['type']): string {
    switch (type) {
      case 'critical':
        return '#dc3545'; // Red
      case 'error':
        return '#fd7e14'; // Orange
      case 'warning':
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  }
  /**
   * Create high error rate alert
   */
  createHighErrorRateAlert(errorRate: number, totalRequests: number): Alert {
    return {
      type: errorRate > 20 ? 'critical' : 'warning',
      title: 'High Webhook Error Rate Detected',
      message: `Webhook error rate has reached ${errorRate.toFixed(2)}% over ${totalRequests} requests.`,
      metadata: {
        errorRate: `${errorRate.toFixed(2)}%`,
        totalRequests,
        threshold: errorRate > 20 ? '20% (critical)' : '10% (warning)',
      },
      timestamp: new Date(),
    };
  }

  /**
   * Create slow processing alert
   */
  createSlowProcessingAlert(processingTime: number, orderId: string): Alert {
    return {
      type: 'warning',
      title: 'Slow Webhook Processing Detected',
      message: `Webhook processing for order ${orderId} took ${processingTime}ms, which exceeds the 5-second threshold.`,
      metadata: {
        orderId,
        processingTime: `${processingTime}ms`,
        threshold: '5000ms',
      },
      timestamp: new Date(),
    };
  }

  /**
   * Create consecutive failures alert
   */
  createConsecutiveFailuresAlert(
    failureCount: number,
    recentCount: number,
  ): Alert {
    return {
      type: failureCount >= 5 ? 'critical' : 'error',
      title: 'Multiple Consecutive Webhook Failures',
      message: `${failureCount} out of the last ${recentCount} webhook attempts have failed.`,
      metadata: {
        failedWebhooks: failureCount,
        totalRecentWebhooks: recentCount,
        failureRate: `${((failureCount / recentCount) * 100).toFixed(1)}%`,
      },
      timestamp: new Date(),
    };
  }
}
