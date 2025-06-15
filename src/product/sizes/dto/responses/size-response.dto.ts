import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { CategoryMinimalDto } from 'src/product/categories/dto';

export class SizeResponseDto {
  @ApiProperty({
    description: 'Size unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Size name',
    example: 'M',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Size description',
    example: 'Medium size for tops',
    required: false,
  })
  @Expose()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether size is active',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Category information',
    type: () => CategoryMinimalDto,
  })
  @Type(() => CategoryMinimalDto)
  @Expose()
  category: CategoryMinimalDto;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  updatedAt: Date;
}
