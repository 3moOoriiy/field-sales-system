import { ApiProperty } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min,
} from 'class-validator';

export class CreateVisitTaskDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty() @IsUUID() agentId!: string;
  @ApiProperty() @IsDateString() scheduledAt!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CheckInDto {
  /** Either taskId (planned visit) OR customerId (ad-hoc visit) is required */
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() taskId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;

  @ApiProperty() @IsNumber() @Min(-90)  @Max(90)  latitude!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;

  /** Override the default radius (e.g. relaxed for one specific customer) */
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(10) @Max(5000)
  allowedRadiusMeters?: number;

  /** Bypass radius check; requires `visit.assign` permission */
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() force?: boolean;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CheckOutDto {
  @ApiProperty() @IsNumber() @Min(-90)  @Max(90)  latitude!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ListTasksQueryDto {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() agentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ required: false, enum: VisitStatus }) @IsOptional() @IsEnum(VisitStatus) status?: VisitStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() from?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() skip?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() take?: string;
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: VisitStatus }) @IsEnum(VisitStatus) status!: VisitStatus;
}
