import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentType, InvoiceStatus } from '@prisma/client';
import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, IsDateString,
  Min, MaxLength, ValidateNested, ArrayMinSize, IsBoolean,
} from 'class-validator';

export class InvoiceItemInput {
  @ApiProperty() @IsUUID() productId!: string;

  @ApiProperty() @IsNumber() @Min(0.001) quantity!: number;

  /** Optional override of selling price; default = product.sellingPrice */
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false, default: 0 }) @IsOptional() @IsNumber() @Min(0)
  discount?: number;
}

export class CreateInvoiceDto {
  @ApiProperty() @IsUUID() customerId!: string;

  @ApiProperty({ required: false, description: 'Defaults to user branch' })
  @IsOptional() @IsUUID() branchId?: string;

  @ApiProperty({ enum: PaymentType, default: PaymentType.CASH })
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;

  @ApiProperty({ type: [InvoiceItemInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => InvoiceItemInput)
  items!: InvoiceItemInput[];

  @ApiProperty({ required: false, default: 0, description: 'Header-level discount amount' })
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;

  @ApiProperty({ required: false, default: 0, description: 'Header-level discount percent (0-100)' })
  @IsOptional() @IsNumber() @Min(0) discountPercent?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueDate?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() createLat?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() createLng?: number;

  /** UUID generated on the device for offline-sync idempotency */
  @ApiProperty({ required: false }) @IsOptional() @IsUUID('all') clientUuid?: string;
}

export class UpdateInvoiceDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueDate?: string;
}

export class CancelInvoiceDto {
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
}

export class MarkPrintedDto {
  @ApiProperty({ required: false, default: true }) @IsOptional() @IsBoolean() printed?: boolean;
}

export class SignatureDto {
  @ApiProperty({
    description:
      'Either a data URL (data:image/png;base64,...) or pure base64 PNG bytes',
  })
  @IsString() dataUrl!: string;
}

export class ListInvoicesQuery {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() agentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty({ required: false, enum: InvoiceStatus }) @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() skip?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() take?: string;
}
