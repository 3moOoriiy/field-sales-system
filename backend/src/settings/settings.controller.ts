import {
  Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  get() { return this.svc.get(); }

  @Patch()
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Update company info' })
  update(@CurrentUser() me: JwtUser, @Body() dto: UpdateSettingsDto) {
    return this.svc.update(me, dto);
  }

  @Post('logo')
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  uploadLogo(@CurrentUser() me: JwtUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.setLogo(me, file);
  }
}
