import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CartItemProductVariantDto {
  @ApiProperty({
    description: 'Product variant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Product variant SKU',
    example: 'SHIRT-RED-M',
  })
  @Expose()
  sku: string;

  @ApiProperty({
    description: 'Product variant price',
    example: 299000,
  })
  @Expose()
  price: number;

  @ApiProperty({
    description: 'Product variant discount price',
    example: 249000,
    required: false,
  })
  @Expose()
  discountPrice?: number;
}

export class CartItemResponseDto {
  @ApiProperty({
    description: 'Cart item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
  })
  @Expose()
  quantity: number;

  @ApiProperty({
    description: 'Product variant information',
    type: CartItemProductVariantDto,
  })
  @Expose()
  @Type(() => CartItemProductVariantDto)
  productVariant: CartItemProductVariantDto;

  @ApiProperty({
    description: 'Cart item creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Cart item last update date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  updatedAt: Date;
}
