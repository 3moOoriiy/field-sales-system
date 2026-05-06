import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Express } from 'express';
import { AttachmentKind } from '@prisma/client';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UploadAttachmentDto } from './dto/attachments.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf',
]);

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadDir: string;
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR', './uploads'));
    const maxMb = Number(config.get<string>('MAX_UPLOAD_MB', '10'));
    this.maxBytes = Math.max(1, maxMb) * 1024 * 1024;
  }

  /**
   * Persist uploaded file to disk and create an Attachment record.
   * Files are stored as {uploadDir}/{kind}/{yyyy-mm}/{uuid}.{ext}
   */
  async save(user: JwtUser, file: Express.Multer.File, dto: UploadAttachmentDto) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`File too large (max ${this.maxBytes} bytes)`);
    }
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException(`Mime type not allowed: ${file.mimetype}`);
    }
    await this.assertParentAuthorized(user, dto);

    const date = new Date();
    const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const ext = (file.originalname.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const subdir = join(dto.kind.toLowerCase(), yyyymm);
    const absDir = join(this.uploadDir, subdir);
    await fs.mkdir(absDir, { recursive: true });

    const absPath = join(absDir, filename);
    await fs.writeFile(absPath, file.buffer);

    const relPath = join(subdir, filename).split(sep).join('/');

    return this.prisma.attachment.create({
      data: {
        kind: dto.kind,
        filePath: relPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        invoiceId: dto.invoiceId,
        returnId: dto.returnId,
        paymentId: dto.paymentId,
        visitId: dto.visitId,
        uploadedById: user.userId,
      },
    });
  }

  /**
   * Save raw bytes (e.g., from a base64 signature) — bypasses multer.
   */
  async saveRaw(args: {
    user: JwtUser;
    kind: AttachmentKind;
    bytes: Buffer;
    originalName: string;
    mimeType: string;
    invoiceId?: string;
    returnId?: string;
    paymentId?: string;
    visitId?: string;
  }) {
    if (args.bytes.length > this.maxBytes) {
      throw new BadRequestException(`File too large (max ${this.maxBytes} bytes)`);
    }
    if (!ALLOWED_MIMETYPES.has(args.mimeType)) {
      throw new BadRequestException(`Mime type not allowed: ${args.mimeType}`);
    }
    const dto: UploadAttachmentDto = {
      kind: args.kind,
      invoiceId: args.invoiceId,
      returnId: args.returnId,
      paymentId: args.paymentId,
      visitId: args.visitId,
    };
    await this.assertParentAuthorized(args.user, dto);

    const date = new Date();
    const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const ext = args.mimeType === 'image/png' ? '.png'
      : args.mimeType === 'image/jpeg' ? '.jpg'
      : args.mimeType === 'application/pdf' ? '.pdf'
      : '';
    const filename = `${randomUUID()}${ext}`;
    const subdir = join(args.kind.toLowerCase(), yyyymm);
    const absDir = join(this.uploadDir, subdir);
    await fs.mkdir(absDir, { recursive: true });
    const absPath = join(absDir, filename);
    await fs.writeFile(absPath, args.bytes);
    const relPath = join(subdir, filename).split(sep).join('/');

    return this.prisma.attachment.create({
      data: {
        kind: args.kind,
        filePath: relPath,
        originalName: args.originalName,
        mimeType: args.mimeType,
        sizeBytes: args.bytes.length,
        invoiceId: args.invoiceId,
        returnId: args.returnId,
        paymentId: args.paymentId,
        visitId: args.visitId,
        uploadedById: args.user.userId,
      },
    });
  }

  async list(user: JwtUser, params: {
    invoiceId?: string; returnId?: string; paymentId?: string; visitId?: string;
  }) {
    const isOwn = !!Object.values(params).find((v) => v); // requires at least one filter
    if (!isOwn) {
      throw new BadRequestException('Provide at least one of invoiceId / returnId / paymentId / visitId');
    }
    await this.assertParentAuthorized(user, params as UploadAttachmentDto);

    return this.prisma.attachment.findMany({
      where: params,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDownloadablePath(user: JwtUser, id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    await this.assertReadAuthorized(user, att);

    const abs = resolve(join(this.uploadDir, att.filePath));
    // path traversal guard
    if (!abs.startsWith(this.uploadDir + sep) && abs !== this.uploadDir) {
      throw new ForbiddenException('Invalid path');
    }
    return { abs, mimeType: att.mimeType, originalName: att.originalName };
  }

  async delete(user: JwtUser, id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    await this.assertReadAuthorized(user, att);

    // Allow uploader or admin to delete
    if (
      att.uploadedById !== user.userId &&
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Not allowed to delete this attachment');
    }

    const abs = resolve(join(this.uploadDir, att.filePath));
    await this.prisma.attachment.delete({ where: { id } });
    fs.unlink(abs).catch((e) => this.logger.warn(`Failed to remove file ${abs}: ${e.message}`));
    return { success: true };
  }

  // ---------- internals ----------

  /**
   * Verify the user can attach to the given parent (invoice/return/payment/visit):
   *  - admins always ok
   *  - agents must own the parent record
   */
  private async assertParentAuthorized(
    user: JwtUser,
    p: { invoiceId?: string; returnId?: string; paymentId?: string; visitId?: string },
  ) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return;

    if (p.invoiceId) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: p.invoiceId }, select: { createdById: true },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
      if (inv.createdById !== user.userId) throw new ForbiddenException('Not your invoice');
    }
    if (p.returnId) {
      const r = await this.prisma.return.findUnique({
        where: { id: p.returnId }, select: { createdById: true },
      });
      if (!r) throw new NotFoundException('Return not found');
      if (r.createdById !== user.userId) throw new ForbiddenException('Not your return');
    }
    if (p.paymentId) {
      const pay = await this.prisma.payment.findUnique({
        where: { id: p.paymentId }, select: { createdById: true },
      });
      if (!pay) throw new NotFoundException('Payment not found');
      if (pay.createdById !== user.userId) throw new ForbiddenException('Not your payment');
    }
    if (p.visitId) {
      const v = await this.prisma.visit.findUnique({
        where: { id: p.visitId }, select: { agentId: true },
      });
      if (!v) throw new NotFoundException('Visit not found');
      if (v.agentId !== user.userId) throw new ForbiddenException('Not your visit');
    }
  }

  private async assertReadAuthorized(
    user: JwtUser,
    att: { invoiceId: string | null; returnId: string | null; paymentId: string | null; visitId: string | null; uploadedById: string | null },
  ) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return;
    if (att.uploadedById === user.userId) return;
    await this.assertParentAuthorized(user, {
      invoiceId: att.invoiceId ?? undefined,
      returnId: att.returnId ?? undefined,
      paymentId: att.paymentId ?? undefined,
      visitId: att.visitId ?? undefined,
    });
  }
}
