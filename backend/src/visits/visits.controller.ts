import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import {
  CreateVisitTaskDto, CheckInDto, CheckOutDto, ListTasksQueryDto, UpdateTaskStatusDto,
} from './dto/visits.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  // ----- Tasks -----

  @Post('tasks')
  @RequirePermissions('visit.assign')
  @ApiOperation({ summary: 'Assign a visit task to an agent' })
  createTask(@CurrentUser() me: JwtUser, @Body() dto: CreateVisitTaskDto) {
    return this.visits.createTask(me, dto);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List visit tasks (agents see only own)' })
  listTasks(
    @CurrentUser() me: JwtUser,
    @Query() q: ListTasksQueryDto,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.visits.listTasks(me, q, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Patch('tasks/:id/status')
  @RequirePermissions('visit.assign')
  updateTaskStatus(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.visits.updateTaskStatus(me, id, dto);
  }

  // ----- Check-in / out -----

  @Post('check-in')
  @RequirePermissions('visit.checkin')
  @ApiOperation({ summary: 'Check in at a customer (radius validated, default 100m)' })
  checkIn(@CurrentUser() me: JwtUser, @Body() dto: CheckInDto) {
    return this.visits.checkIn(me, dto);
  }

  @Post(':id/check-out')
  @RequirePermissions('visit.checkin')
  @ApiOperation({ summary: 'Check out of a visit' })
  checkOut(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.visits.checkOut(me, id, dto);
  }

  // ----- Browsing / reports -----

  @Get()
  listVisits(
    @CurrentUser() me: JwtUser,
    @Query() q: ListTasksQueryDto,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.visits.listVisits(me, q, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('ranking')
  @RequirePermissions('visit.view.all')
  @ApiOperation({ summary: 'Visit performance ranking by agent (window optional)' })
  ranking(@Query('from') from?: string, @Query('to') to?: string) {
    return this.visits.ranking(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get(':id')
  getVisit(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.getVisit(me, id);
  }
}
