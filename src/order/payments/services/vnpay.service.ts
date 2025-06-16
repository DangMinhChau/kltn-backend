import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface VNPayConfig {
  tmnCode: string;
  secretKey: string;
  url: string;
  returnUrl: string;
  version: string;
  command: string;
  currCode: string;
}

export interface CreatePaymentUrlParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  clientIp: string;
  locale?: string;
}

export interface VNPayReturnQuery {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo: string;
  vnp_CardType: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
}

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);
  private readonly config: VNPayConfig;
  constructor(private configService: ConfigService) {
    this.config = {
      tmnCode: this.configService.get<string>('VNPAY_TMN_CODE') || '',
      secretKey: this.configService.get<string>('VNPAY_SECRET_KEY') || '',
      url:
        this.configService.get<string>('VNPAY_URL') ||
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: this.configService.get<string>('VNPAY_RETURN_URL') || '',
      version: '2.1.0',
      command: 'pay',
      currCode: 'VND',
    };
  }

  /**
   * Tạo URL thanh toán VNPay
   */
  createPaymentUrl(params: CreatePaymentUrlParams): string {
    const { orderId, amount, orderInfo, clientIp, locale = 'vn' } = params;

    const createDate = this.formatDate(new Date());
    const expireDate = this.formatDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 phút

    const vnpParams: Record<string, string> = {
      vnp_Version: this.config.version,
      vnp_Command: this.config.command,
      vnp_TmnCode: this.config.tmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: this.config.currCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: (amount * 100).toString(), // VNPay yêu cầu amount * 100
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: clientIp,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // Sắp xếp params theo alphabet
    const sortedParams = this.sortParams(vnpParams);

    // Tạo query string
    const queryString = this.buildQueryString(sortedParams);

    // Tạo secure hash
    const secureHash = this.createSecureHash(queryString);

    // Thêm hash vào params
    sortedParams.vnp_SecureHash = secureHash;

    // Tạo URL cuối cùng
    const finalQueryString = this.buildQueryString(sortedParams);
    const paymentUrl = `${this.config.url}?${finalQueryString}`;

    this.logger.log(`Created VNPay payment URL for order ${orderId}`);
    return paymentUrl;
  }

  /**
   * Xác minh callback từ VNPay
   */
  verifyReturn(query: VNPayReturnQuery): boolean {
    const { vnp_SecureHash, ...params } = query;

    // Sắp xếp params
    const sortedParams = this.sortParams(params);

    // Tạo query string
    const queryString = this.buildQueryString(sortedParams);

    // Tạo secure hash để so sánh
    const calculatedHash = this.createSecureHash(queryString);

    const isValid = calculatedHash === vnp_SecureHash;

    this.logger.log(
      `VNPay return verification: ${isValid ? 'SUCCESS' : 'FAILED'}`,
    );
    return isValid;
  }

  /**
   * Parse kết quả thanh toán từ VNPay
   */
  parsePaymentResult(query: VNPayReturnQuery) {
    const isSuccess =
      query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';

    return {
      isSuccess,
      orderId: query.vnp_TxnRef,
      amount: parseInt(query.vnp_Amount) / 100, // Chia 100 để về số tiền gốc
      transactionId: query.vnp_TransactionNo,
      bankCode: query.vnp_BankCode,
      bankTranNo: query.vnp_BankTranNo,
      cardType: query.vnp_CardType,
      payDate: this.parseVNPayDate(query.vnp_PayDate),
      responseCode: query.vnp_ResponseCode,
      orderInfo: query.vnp_OrderInfo,
    };
  }

  /**
   * Kiểm tra trạng thái giao dịch
   */
  getTransactionStatus(responseCode: string): string {
    const statusMap: Record<string, string> = {
      '00': 'SUCCESS',
      '07': 'PENDING',
      '09': 'FAILED',
      '10': 'FAILED',
      '11': 'FAILED',
      '12': 'FAILED',
      '13': 'FAILED',
      '24': 'CANCELLED',
      '51': 'FAILED',
      '65': 'FAILED',
      '75': 'FAILED',
      '79': 'FAILED',
      '99': 'FAILED',
    };

    return statusMap[responseCode] || 'UNKNOWN';
  }

  /**
   * Tạo secure hash cho VNPay
   */
  private createSecureHash(data: string): string {
    return crypto
      .createHmac('sha512', this.config.secretKey)
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');
  }

  /**
   * Sắp xếp params theo alphabet
   */
  private sortParams(params: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    Object.keys(params)
      .sort()
      .forEach((key) => {
        sorted[key] = params[key];
      });
    return sorted;
  }

  /**
   * Tạo query string từ params
   */
  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  /**
   * Format date cho VNPay (yyyyMMddHHmmss)
   */ private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Parse VNPay date format
   */
  private parseVNPayDate(dateString: string): Date {
    // VNPay format: yyyyMMddHHmmss
    const year = parseInt(dateString.substring(0, 4));
    const month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateString.substring(6, 8));
    const hour = parseInt(dateString.substring(8, 10));
    const minute = parseInt(dateString.substring(10, 12));
    const second = parseInt(dateString.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }
}
