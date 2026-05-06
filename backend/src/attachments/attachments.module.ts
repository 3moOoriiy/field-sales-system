import { Global, Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Global()
@Module({
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
