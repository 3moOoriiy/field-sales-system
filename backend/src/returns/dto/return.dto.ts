import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReturnReason } from '@prisma/client';
import {
  ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min,
  MaxLength, ValidateNested, IsBoolean, IsDateString,
} from 'class-validator';

export class ReturnItemInput {
  @ApiProperty() @IsUUID() invoiceItemId!: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity!: number;
}

export class CreateReturnDto {
  @ApiProperty() @IsUUID() invoiceId!: string;

  @ApiProperty({ enum: ReturnReason, default: ReturnReason.OTHER })
  @IsOptional() @IsEnum(ReturnReason) reason?: ReturnReason;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) reasonNote?: string;

  /** True = return all remaining unreturned quantity for every invoice item */
  @ApiProperty({ required: false, default: false }) @IsOptional() @IsBoolean() fullReturn?: boolean;

  @ApiProperty({ type: [ReturnItemInput], required: false })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => ReturnItemInput)
  items?: ReturnItemInput[];

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() restock?: boolean;
}

export class ListReturnsQuery {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() invoiceId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() agentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() skip?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() take?: string;
}
