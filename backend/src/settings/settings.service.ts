import { Injectable } from '@nestjs/common';
import { AuditAction, AttachmentKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { JwtUser } from '../auth/decorators/current-user.decorator';

/** Drop entries whose value is `undefined` so Prisma doesn't reject required fields. */
function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attachments: AttachmentsService,
  ) {}

  async get() {
    return this.prisma.setting.upsert({
      where: { id: 1 },
      create: { id: 1, companyName: 'Field Sales Co.', defaultCurrency: 'SAR', defaultLocale: 'ar' },
      update: {},
    });
  }

  async update(user: JwtUser, dto: UpdateSettingsDto) {
    const data = stripUndefined(dto as unknown as Record<string, unknown>);

    const createInput: Prisma.SettingCreateInput = {
      id: 1,
      companyName: 'Field Sales Co.',
      defaultCurrency: 'SAR',
      defaultLocale: 'ar',
      ...data,
    } as Prisma.SettingCreateInput;

    const updated = await this.prisma.setting.upsert({
      where: { id: 1 },
      create: createInput,
      update: data as Prisma.SettingUpdateInput,
    });
    await this.audit.log({
      userId: user.userId,
      action: AuditAction.SETTINGS_UPDATED,
      entityType: 'settings',
      entityId: '1',
      metadata: data as Record<string, unknown>,
    });
    return updated;
  }

  async setLogo(user: JwtUser, file: Express.Multer.File) {
    const att = await this.attachments.save(user, file, { kind: AttachmentKind.COMPANY_LOGO });
    const updated = await this.prisma.setting.upsert({
      where: { id: 1 },
      create: { id: 1, companyName: 'Field Sales Co.', defaultCurrency: 'SAR', defaultLocale: 'ar', logoPath: att.filePath },
      update: { logoPath: att.filePath },
    });
    await this.audit.log({
      userId: user.userId,
      action: AuditAction.SETTINGS_UPDATED,
      entityType: 'settings',
      entityId: '1',
      metadata: { logoPath: att.filePath },
    });
    return updated;
  }
}
