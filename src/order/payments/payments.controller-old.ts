import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Logger,
  UseFilters,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrderPaymentService } from '../orders/order-payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VNPayCallbackDto } from './dto/payment-gateway.dto';
import {
  CreateOrderPaymentDto,
  PaymentRetryDto,
} from '../orders/dto/create-order-payment.dto';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { Roles, ResponseMessage } from 'src/common/decorators';
import { UserRole } from 'src/common/constants/user-role.enum';
import { OrderExceptionFilter } from '../filters/order-exception.filter';

@Controller('payments')
@UseFilters(OrderExceptionFilter)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly orderPaymentService: OrderPaymentService,
  ) {}

  // =================== ORDER + PAYMENT CREATION ===================  @Post('order-with-payment')
  @ResponseMessage('Order with payment created successfully')
  @UseGuards(JwtAuthGuard)
  async createOrderWithPayment(
    @Body() createOrderPaymentDto: CreateOrderPaymentDto,
  ) {
    this.logger.log(
      `Creating order with payment for user ${createOrderPaymentDto.userId} using ${createOrderPaymentDto.paymentMethod}`,
    );

    return await this.orderPaymentService.createOrderWithPayment(
      createOrderPaymentDto,
    );
  }
  // =================== STANDALONE PAYMENT CREATION ===================  @Post()
  @ResponseMessage('Payment created successfully')
  @UseGuards(JwtAuthGuard)
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    this.logger.log(
      `Creating payment for order ${createPaymentDto.orderId} with method ${createPaymentDto.method}`,
    );

    return await this.paymentsService.create(createPaymentDto);
  }
  @Post('retry')
  @ResponseMessage('Payment retry initiated successfully')
  @UseGuards(JwtAuthGuard)
  async retryPayment(@Body() paymentRetryDto: PaymentRetryDto) {
    this.logger.log(`Retrying payment for order ${paymentRetryDto.orderId}`);

    const createPaymentDto: CreatePaymentDto = {
      orderId: paymentRetryDto.orderId,
      method: paymentRetryDto.paymentMethod,
      amount: 0, // Will be calculated from order
      returnUrl: paymentRetryDto.returnUrl,
    };

    return await this.paymentsService.retryPayment(
      paymentRetryDto.orderId,
      createPaymentDto,
    );
  }
  // =================== PAYMENT QUERIES ===================
  @Get()
  @ResponseMessage('Payments retrieved successfully')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    return await this.paymentsService.findAll(pageNum, limitNum);
  }
  @Get('order/:orderId')
  @ResponseMessage('Payment retrieved successfully')
  @UseGuards(JwtAuthGuard)
  async findByOrderId(@Param('orderId') orderId: string) {
    return await this.paymentsService.findByOrderId(orderId);
  }
  @Get('order/:orderId/history')
  @ResponseMessage('Payment history retrieved successfully')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@Param('orderId') orderId: string) {
    return await this.paymentsService.getPaymentHistory(orderId);
  }
  @Get(':id')
  @ResponseMessage('Payment retrieved successfully')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return await this.paymentsService.findOne(id);
  }
  // =================== PAYMENT CALLBACKS ===================
  @Post('vnpay/callback')
  @ResponseMessage('VNPay callback processed successfully')
  async vnpayCallback(@Body() callbackData: VNPayCallbackDto) {
    this.logger.log(
      `VNPay callback received for transaction ${callbackData.vnp_TxnRef}`,
    );

    return await this.paymentsService.handleVNPayCallback(callbackData);
  }

  // =================== PAYMENT MANAGEMENT ===================
  @Patch(':id')
  @ResponseMessage('Payment updated successfully')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return await this.paymentsService.update(id, updatePaymentDto);
  }
  @Delete(':id')
  @ResponseMessage('Payment deleted successfully')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<null> {
    await this.paymentsService.remove(id);
    return null;
  }
  @Post('cleanup-abandoned')
  @ResponseMessage('Abandoned payments cleaned up successfully')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async cleanupAbandonedPayments(
    @Body('timeThresholdMinutes') timeThresholdMinutes?: number,
  ) {
    return await this.paymentsService.handleAbandonedPayments(
      timeThresholdMinutes,
    );
  }
}
