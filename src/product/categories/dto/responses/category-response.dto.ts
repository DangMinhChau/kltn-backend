import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CategoryResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Category unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;
  @Expose()
  @ApiProperty({
    description: 'Category name',
    example: 'Áo thun',
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'Category URL-friendly slug',
    example: 'ao-thun',
  })
  slug: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Các loại áo thun chất lượng cao',
  })
  description?: string;
  @Expose()
  @ApiProperty({
    description: 'Whether category is active and visible',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: 'Parent category ID if this is a subcategory',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  parentId?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Parent category information',
    type: () => CategoryResponseDto,
  })
  @Type(() => CategoryResponseDto)
  parent?: CategoryResponseDto;

  @ApiPropertyOptional({
    description: 'Child categories',
    type: [CategoryResponseDto],
  })
  children?: CategoryResponseDto[];

  @ApiProperty({
    description: 'Category creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Category last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
