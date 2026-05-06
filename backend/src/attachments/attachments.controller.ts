import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto/attachments.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @RequirePermissions('attachment.upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Upload one file. Multipart fields: file (binary), kind, and at least one of invoiceId/returnId/paymentId/visitId.',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string' },
        invoiceId: { type: 'string', format: 'uuid' },
        returnId: { type: 'string', format: 'uuid' },
        paymentId: { type: 'string', format: 'uuid' },
        visitId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'kind'],
    },
  })
  upload(
    @CurrentUser() me: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
  ) {
    if (!dto.invoiceId && !dto.returnId && !dto.paymentId && !dto.visitId) {
      throw new BadRequestException('Provide at least one parent ID');
    }
    return this.attachments.save(me, file, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List attachments for one parent record' })
  list(
    @CurrentUser() me: JwtUser,
    @Query('invoiceId') invoiceId?: string,
    @Query('returnId') returnId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('visitId') visitId?: string,
  ) {
    return this.attachments.list(me, { invoiceId, returnId, paymentId, visitId });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Stream the file (auth-gated)' })
  async download(
    @CurrentUser() me: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { abs, mimeType, originalName } = await this.attachments.getDownloadablePath(me, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(originalName)}"`,
    );
    createReadStream(abs).pipe(res);
  }

  @Delete(':id')
  @RequirePermissions('attachment.upload')
  delete(@CurrentUser() me: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.delete(me, id);
  }
}
