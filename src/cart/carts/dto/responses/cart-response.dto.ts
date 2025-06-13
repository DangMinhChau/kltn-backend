import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CartResponseDto {
  @ApiProperty({
    description: 'Cart ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'User ID who owns the cart',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Expose()
  userId: string;

  @ApiProperty({
    description: 'Total number of items in cart',
    example: 3,
  })
  @Expose()
  totalItems: number;

  @ApiProperty({
    description: 'Total price of all items in cart',
    example: 899000,
  })
  @Expose()
  totalPrice: number;

  @ApiProperty({
    description: 'Cart creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Cart last update timestamp',
    example: '2024-01-15T11:45:00Z',
  })
  @Expose()
  updatedAt: Date;
}
