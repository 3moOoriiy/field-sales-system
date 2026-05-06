import { ApiProperty } from '@nestjs/swagger';
import { AttachmentKind } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UploadAttachmentDto {
  @ApiProperty({ enum: AttachmentKind })
  @IsEnum(AttachmentKind)
  kind!: AttachmentKind;

  @ApiProperty({ required: false }) @IsOptional() @IsUUID() invoiceId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() returnId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() paymentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() visitId?: string;
}
