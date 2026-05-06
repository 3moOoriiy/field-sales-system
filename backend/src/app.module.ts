import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { configValidation } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ReturnsModule } from './returns/returns.module';
import { PaymentsModule } from './payments/payments.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TrackingModule } from './tracking/tracking.module';
import { VisitsModule } from './visits/visits.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { PdfModule } from './pdf/pdf.module';
import { PrintModule } from './print/print.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { SettingsModule } from './settings/settings.module';
import { BranchesModule } from './branches/branches.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './health/health.controller';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidation,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 100),
      },
    ]),
    PrismaModule,
    AuditModule,
    RealtimeModule,
    AttachmentsModule,
    PdfModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CustomersModule,
    InvoicesModule,
    ReturnsModule,
    PaymentsModule,
    TrackingModule,
    VisitsModule,
    PrintModule,
    AuditLogsModule,
    SettingsModule,
    BranchesModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
