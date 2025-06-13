import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCartItemDto {
  @ApiProperty({
    description: 'ID of the cart to add item to',
    example: 'uuid-cart-id',
  })
  @IsString()
  @IsNotEmpty()
  cartId: string;

  @ApiProperty({
    description: 'ID of the product variant to add',
    example: 'uuid-variant-id',
  })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({
    description: 'Quantity of the item to add',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}
