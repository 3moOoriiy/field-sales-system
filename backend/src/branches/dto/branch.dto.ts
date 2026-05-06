import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(20) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  phone?: string;
}

export class UpdateBranchDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40)  phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()                isActive?: boolean;
}
