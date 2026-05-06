import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'superadmin' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
