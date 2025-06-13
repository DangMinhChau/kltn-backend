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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  CompleteOrderDto,
  OrderResponseDto,
} from './dto';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { Roles, GetUserId } from 'src/common/decorators';
import { UserRole } from 'src/common/constants/user-role.enum';

@ApiTags('Orders')
@ApiExtraModels(OrderResponseDto, BaseResponseDto, PaginatedResponseDto)
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(OrderResponseDto) },
          },
        },
      ],
    },
  })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Create complete order' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(OrderResponseDto) },
          },
        },
      ],
    },
  })
  createComplete(@Body() completeOrderDto: CompleteOrderDto) {
    return this.ordersService.createComplete(completeOrderDto);
  }
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all orders (Admin only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(OrderResponseDto) },
            },
          },
        },
      ],
    },
  })
  findAll(@Query() queryDto: OrderQueryDto) {
    return this.ordersService.findAll(
      undefined,
      queryDto.status,
      queryDto.page,
      queryDto.limit,
    );
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Get user orders' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(OrderResponseDto) },
            },
          },
        },
      ],
    },
  })
  getMyOrders(@GetUserId() userId: string, @Query() queryDto: OrderQueryDto) {
    return this.ordersService.findByUserId(userId, queryDto);
  }

  @Get('my-orders-advanced')
  @ApiOperation({ summary: 'Get user orders with advanced filtering' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(OrderResponseDto) },
            },
          },
        },
      ],
    },
  })
  getMyOrdersAdvanced(
    @GetUserId() userId: string,
    @Query() queryDto: OrderQueryDto,
  ) {
    return this.ordersService.findByUserIdAdvanced(userId, queryDto);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getSummary() {
    return this.ordersService.getSummary();
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.ordersService.getStats();
  }

  @Get('number/:orderNumber')
  findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findByOrderNumber(orderNumber);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.ordersService.getOrderDetails(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    await this.ordersService.remove(id);
  }
}
