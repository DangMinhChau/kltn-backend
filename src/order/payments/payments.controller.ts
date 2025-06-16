import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VNPayCallbackDto } from './dto/payment-gateway.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<BaseResponseDto> {
    const payment = await this.paymentsService.create(createPaymentDto);
    return {
      message: 'Payment created successfully',
      data: payment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
  @Post('vnpay/callback')
  @ApiOperation({ summary: 'Handle VNPay payment callback' })
  @ApiResponse({ status: 200, description: 'Callback processed successfully' })
  async handleVNPayCallback(
    @Body() callbackData: VNPayCallbackDto,
  ): Promise<BaseResponseDto> {
    this.logger.log('Received VNPay callback');
    const payment =
      await this.paymentsService.handleVNPayCallback(callbackData);
    return {
      message: 'Payment processed successfully',
      data: payment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<PaginatedResponseDto> {
    const result = await this.paymentsService.findAll(page, limit);
    return {
      message: 'Payments retrieved successfully',
      data: result.data,
      meta: {
        ...result.meta,
        totalPages: Math.ceil(result.meta.total / result.meta.limit),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  async findOne(@Param('id') id: string): Promise<BaseResponseDto> {
    const payment = await this.paymentsService.findOne(id);
    return {
      message: 'Payment found successfully',
      data: payment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
