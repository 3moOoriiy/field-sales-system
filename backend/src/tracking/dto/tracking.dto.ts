import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsUUID,
  Max, Min, ValidateNested,
} from 'class-validator';

export class LocationPointDto {
  @ApiProperty() @IsNumber() @Min(-90)  @Max(90)  latitude!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() accuracy?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() speed?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() heading?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100) battery?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() recordedAt?: string;
}

export class SubmitLocationDto extends LocationPointDto {}

export class SubmitLocationBatchDto {
  @ApiProperty({ type: [LocationPointDto] })
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  @Type(() => LocationPointDto)
  points!: LocationPointDto[];
}

export class HistoryQueryDto {
  @ApiProperty() @IsUUID() agentId!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() to?: string;
}
