import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class VNPayWebhookDto {
  @IsString()
  vnp_TmnCode: string;

  @IsNumberString()
  vnp_Amount: string;

  @IsOptional()
  @IsString()
  vnp_BankCode?: string;

  @IsOptional()
  @IsString()
  vnp_BankTranNo?: string;

  @IsOptional()
  @IsString()
  vnp_CardType?: string;

  @IsString()
  vnp_OrderInfo: string;

  @IsString()
  vnp_PayDate: string;

  @IsString()
  vnp_ResponseCode: string;

  @IsString()
  vnp_TransactionNo: string;

  @IsString()
  vnp_TransactionStatus: string;

  @IsString()
  vnp_TxnRef: string;

  @IsString()
  vnp_SecureHashType: string;

  @IsString()
  vnp_SecureHash: string;

  // Additional fields that might be included in webhook
  @IsOptional()
  @IsString()
  vnp_Version?: string;

  @IsOptional()
  @IsString()
  vnp_Command?: string;

  @IsOptional()
  @IsString()
  vnp_CurrCode?: string;

  @IsOptional()
  @IsString()
  vnp_Locale?: string;

  @IsOptional()
  @IsString()
  vnp_OrderType?: string;

  @IsOptional()
  @IsString()
  vnp_IpAddr?: string;

  @IsOptional()
  @IsString()
  vnp_CreateDate?: string;
}
