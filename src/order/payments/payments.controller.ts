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
  constructor(private readonly paymentsService: PaymentsService) {}
}
