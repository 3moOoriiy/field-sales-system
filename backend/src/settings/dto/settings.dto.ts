import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsEmail } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) companyNameAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  taxNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail()                  email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) invoiceFooter?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) invoiceFooterAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(8)   defaultCurrency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(8)   defaultLocale?: string;
}
