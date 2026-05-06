import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, IsDateString,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty() @IsUUID() customerId!: string;

  @ApiProperty({ required: false, description: 'Optional — applies to a specific invoice' })
  @IsOptional() @IsUUID() invoiceId?: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;

  @ApiProperty() @IsNumber() @Min(0.01) amount!: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() createLat?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() createLng?: number;
}

export class ListPaymentsQuery {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() invoiceId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() agentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() skip?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() take?: string;
}
