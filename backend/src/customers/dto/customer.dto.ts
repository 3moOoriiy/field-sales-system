import { ApiProperty } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsUUID, IsEmail,
  MinLength, MaxLength, Min, Max,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)
  code?: string; // auto-generated if missing

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200)
  storeName!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  taxNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail()                  email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) region?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-90)  @Max(90)  latitude?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() branchId?: string;
}

export class UpdateCustomerDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) storeName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  taxNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail()                  email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) region?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-90)  @Max(90)  latitude?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}
