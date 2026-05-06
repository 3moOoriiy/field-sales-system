import {
  Body, Controller, Get, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import {
  SubmitLocationDto, SubmitLocationBatchDto, HistoryQueryDto,
} from './dto/tracking.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('location')
  @RequirePermissions('tracking.submit')
  @ApiOperation({ summary: 'Agent submits a GPS point' })
  submit(@CurrentUser() me: JwtUser, @Body() dto: SubmitLocationDto) {
    return this.tracking.submit(me.userId, [dto]);
  }

  @Post('location/batch')
  @RequirePermissions('tracking.submit')
  @ApiOperation({ summary: 'Agent submits a batch of GPS points (offline catch-up)' })
  submitBatch(@CurrentUser() me: JwtUser, @Body() dto: SubmitLocationBatchDto) {
    return this.tracking.submit(me.userId, dto.points);
  }

  @Get('agents-live')
  @RequirePermissions('tracking.view')
  @ApiOperation({ summary: 'Snapshot of every agent: online status + last GPS' })
  live(@Query('branchId') branchId?: string) {
    return this.tracking.live(branchId);
  }

  @Get('agent-history')
  @RequirePermissions('tracking.view')
  @ApiOperation({ summary: 'Movement history for one agent (asc by time, max 5000 pts)' })
  history(@Query() q: HistoryQueryDto) {
    return this.tracking.history(
      q.agentId,
      q.from ? new Date(q.from) : undefined,
      q.to ? new Date(q.to) : undefined,
    );
  }
}
