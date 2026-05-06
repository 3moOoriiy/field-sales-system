import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsArray,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString() @MinLength(3) @MaxLength(64)
  username!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  role!: RoleName;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  branchId?: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  branchId?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128)
  newPassword!: string;
}

export class SetPermissionsDto {
  @ApiProperty({ type: [String], description: 'Permission codes to grant' })
  @IsArray() @IsString({ each: true })
  grant!: string[];

  @ApiProperty({ type: [String], description: 'Permission codes to deny (override role)' })
  @IsArray() @IsString({ each: true })
  deny!: string[];
}

export class SetAgentLimitsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100)
  maxDiscountPercent?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  maxDiscountAmount?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  maxInvoiceTotal?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  preventBelowCost?: boolean;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  allowEditAfterPrint?: boolean;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  allowReturns?: boolean;
}
