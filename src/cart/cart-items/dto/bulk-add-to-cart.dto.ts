import { IsArray, IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCartItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class BulkAddToCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCartItemDto)
  items: BulkCartItemDto[];
}
