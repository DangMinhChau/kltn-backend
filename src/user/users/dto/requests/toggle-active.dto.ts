import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class ToggleActiveDto {
  @ApiProperty({
    description: 'Active status for the user',
    example: true,
  })
  @IsNotEmpty({ message: 'Trạng thái hoạt động không được để trống' })
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  isActive: boolean;
}
