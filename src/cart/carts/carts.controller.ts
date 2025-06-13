import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { CartsService } from './carts.service';
import {
  CreateCartDto,
  UpdateCartDto,
  MergeGuestCartDto,
  CartResponseDto,
  CartSummaryResponseDto,
  CartRecommendationsResponseDto,
  ShippingEstimateResponseDto,
  CartWithItemsResponseDto,
} from './dto';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { Roles, GetUserId } from 'src/common/decorators';
import { UserRole } from 'src/common/constants/user-role.enum';

@ApiTags('Carts')
@ApiExtraModels(
  CartResponseDto,
  CartSummaryResponseDto,
  CartRecommendationsResponseDto,
  ShippingEstimateResponseDto,
  CartWithItemsResponseDto,
  MergeGuestCartDto,
  BaseResponseDto,
  PaginatedResponseDto,
)
@ApiBearerAuth()
@Controller('carts')
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
          },
        },
      ],
    },
  })
  create(@Body() createCartDto: CreateCartDto) {
    return this.cartsService.create(createCartDto);
  }
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all carts (Admin only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CartResponseDto) },
            },
          },
        },
      ],
    },
  })
  findAll() {
    return this.cartsService.findAll();
  }

  @Get('my-cart')
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
          },
        },
      ],
    },
  })
  getMyCart(@GetUserId() userId: string) {
    return this.cartsService.getMyCart(userId);
  }
  @Get('summary')
  @ApiOperation({ summary: 'Get cart summary for current user' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartSummaryResponseDto) },
          },
        },
      ],
    },
  })
  getCartSummary(@GetUserId() userId: string) {
    return this.cartsService.getCartSummary(userId);
  }
  @Get('recommendations')
  @ApiOperation({ summary: 'Get cart recommendations for current user' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartRecommendationsResponseDto) },
          },
        },
      ],
    },
  })
  getCartRecommendations(@GetUserId() userId: string) {
    return this.cartsService.getCartRecommendations(userId);
  }
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get cart by ID (Admin only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
          },
        },
      ],
    },
  })
  findOne(@Param('id') id: string) {
    return this.cartsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
          },
        },
      ],
    },
  })
  update(@Param('id') id: string, @Body() updateCartDto: UpdateCartDto) {
    return this.cartsService.update(id, updateCartDto);
  }

  @Post('merge-guest-cart')
  @ApiOperation({ summary: 'Merge guest cart with user cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
          },
        },
      ],
    },
  })
  mergeGuestCart(
    @GetUserId() userId: string,
    @Body() mergeGuestCartDto: MergeGuestCartDto,
  ) {
    return this.cartsService.mergeGuestCart(userId, mergeGuestCartDto.items);
  }
  @Post('shipping-estimate')
  @ApiOperation({ summary: 'Get shipping estimate for cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(ShippingEstimateResponseDto) },
          },
        },
      ],
    },
  })
  getShippingEstimate(@GetUserId() userId: string, @Body() addressData: any) {
    return this.cartsService.getShippingEstimate(userId, addressData);
  }

  @Delete(':id/clear')
  @ApiOperation({ summary: 'Clear cart by ID' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { type: 'null' },
          },
        },
      ],
    },
  })
  clearCart(@Param('id') id: string) {
    return this.cartsService.clearCart(id);
  }

  @Delete('my-cart/clear')
  @ApiOperation({ summary: 'Clear current user cart' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { type: 'null' },
          },
        },
      ],
    },
  })
  clearMyCart(@GetUserId() userId: string) {
    return this.cartsService.clearMyCart(userId);
  }
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete cart (Admin only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { type: 'null' },
          },
        },
      ],
    },
  })
  remove(@Param('id') id: string) {
    return this.cartsService.remove(id);
  }
}
