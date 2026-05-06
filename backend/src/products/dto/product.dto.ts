import { ApiProperty } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, Min, IsBoolean, IsUUID, MinLength, MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64)
  sku!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64)
  barcode?: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200)
  nameAr?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiProperty({ default: 'piece' }) @IsOptional() @IsString() @MaxLength(20)
  unitType?: string;

  @ApiProperty() @IsNumber() @Min(0)
  costPrice!: number;

  @ApiProperty() @IsNumber() @Min(0)
  sellingPrice!: number;

  @ApiProperty({ default: 0 }) @IsOptional() @IsNumber() @Min(0)
  taxPercent?: number;

  @ApiProperty({ default: 0 }) @IsOptional() @IsNumber() @Min(0)
  stockQty?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255)
  imagePath?: string;

  @ApiProperty({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) barcode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() categoryId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) unitType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) taxPercent?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) stockQty?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() imagePath?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) nameAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() parentId?: string;
}
