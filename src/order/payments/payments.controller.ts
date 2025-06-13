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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators';
import { PaymentsService } from './payments.service';
import { OrderPaymentService } from '../orders/order-payment.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  VNPayCallbackDto,
  PaymentResponseDto,
} from './dto';
import {
  CreateOrderPaymentDto,
  PaymentRetryDto,
} from '../orders/dto/create-order-payment.dto';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { Roles } from 'src/common/decorators';
import { UserRole } from 'src/common/constants/user-role.enum';
import { OrderExceptionFilter } from '../filters/order-exception.filter';

@ApiTags('Payments')
@ApiExtraModels(PaymentResponseDto, BaseResponseDto, PaginatedResponseDto)
@ApiBearerAuth()
@Controller('payments')
@UseFilters(OrderExceptionFilter)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly orderPaymentService: OrderPaymentService,
  ) {}
  @Post('order-with-payment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create order with payment' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { type: 'object' },
          },
        },
      ],
    },
  })
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
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create payment' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(PaymentResponseDto) },
          },
        },
      ],
    },
  })
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    this.logger.log(
      `Creating payment for order ${createPaymentDto.orderId} with method ${createPaymentDto.method}`,
    );

    return await this.paymentsService.create(createPaymentDto);
  }
  @Post('retry')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retry payment' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(PaymentResponseDto) },
          },
        },
      ],
    },
  })
  async retryPayment(@Body() paymentRetryDto: PaymentRetryDto) {
    this.logger.log(`Retrying payment for order ${paymentRetryDto.orderId}`);

    const createPaymentDto: CreatePaymentDto = {
      orderId: paymentRetryDto.orderId,
      method: paymentRetryDto.paymentMethod,
      amount: 0,
      returnUrl: paymentRetryDto.returnUrl,
    };

    return await this.paymentsService.retryPayment(
      paymentRetryDto.orderId,
      createPaymentDto,
    );
  }
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all payments (Admin only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(PaymentResponseDto) },
            },
          },
        },
      ],
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    return await this.paymentsService.findAll(pageNum, limitNum);
  }
  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payments by order ID' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(PaymentResponseDto) },
            },
          },
        },
      ],
    },
  })
  async findByOrderId(@Param('orderId') orderId: string) {
    return await this.paymentsService.findByOrderId(orderId);
  }
  @Get('order/:orderId/history')
  @ResponseMessage('Payment history retrieved successfully')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment history for order' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(PaymentResponseDto) },
            },
          },
        },
      ],
    },
  })
  async getPaymentHistory(@Param('orderId') orderId: string) {
    return await this.paymentsService.getPaymentHistory(orderId);
  }
  @Get(':id')
  @ResponseMessage('Payment retrieved successfully')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(PaymentResponseDto) },
          },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string) {
    return await this.paymentsService.findOne(id);
  }

  @Post('vnpay/callback')
  @ResponseMessage('VNPay callback processed successfully')
  async vnpayCallback(@Body() callbackData: VNPayCallbackDto) {
    this.logger.log(
      `VNPay callback received for transaction ${callbackData.vnp_TxnRef}`,
    );

    return await this.paymentsService.handleVNPayCallback(callbackData);
  }

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
