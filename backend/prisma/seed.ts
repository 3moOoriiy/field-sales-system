/* eslint-disable no-console */
import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALL_PERMISSIONS: Array<{ code: string; group: string; description: string }> = [
  // Invoices
  { code: 'invoice.create', group: 'Invoices', description: 'Create invoice' },
  { code: 'invoice.update', group: 'Invoices', description: 'Edit invoice' },
  { code: 'invoice.cancel', group: 'Invoices', description: 'Cancel invoice' },
  { code: 'invoice.view.own', group: 'Invoices', description: 'View only own invoices' },
  { code: 'invoice.view.all', group: 'Invoices', description: 'View all invoices' },
  { code: 'invoice.discount', group: 'Invoices', description: 'Apply discount on invoice' },
  { code: 'invoice.edit_after_print', group: 'Invoices', description: 'Edit after printing' },

  // Customers
  { code: 'customer.create', group: 'Customers', description: 'Create customer' },
  { code: 'customer.update', group: 'Customers', description: 'Edit customer' },
  { code: 'customer.view.all', group: 'Customers', description: 'View all customers' },

  // Products
  { code: 'product.view', group: 'Products', description: 'View products' },
  { code: 'product.manage', group: 'Products', description: 'Create/update products' },

  // Returns
  { code: 'return.create', group: 'Returns', description: 'Create returns' },
  { code: 'return.view.all', group: 'Returns', description: 'View all returns' },

  // Payments
  { code: 'payment.create', group: 'Payments', description: 'Record payment / collection' },
  { code: 'payment.view.all', group: 'Payments', description: 'View all payments' },

  // Visits
  { code: 'visit.checkin', group: 'Visits', description: 'Check-in to visit task' },
  { code: 'visit.assign', group: 'Visits', description: 'Assign visit tasks' },
  { code: 'visit.view.all', group: 'Visits', description: 'View all visits' },

  // Tracking
  { code: 'tracking.submit', group: 'Tracking', description: 'Submit GPS location' },
  { code: 'tracking.view', group: 'Tracking', description: 'View agent tracking on map' },

  // Reports
  { code: 'report.sales', group: 'Reports', description: 'View sales reports' },
  { code: 'report.profit', group: 'Reports', description: 'View profit reports' },
  { code: 'report.debts', group: 'Reports', description: 'View debts reports' },
  { code: 'report.collections', group: 'Reports', description: 'View collections reports' },

  // Attachments
  { code: 'attachment.upload', group: 'Attachments', description: 'Upload attachments / photos' },

  // Admin
  { code: 'user.manage', group: 'Admin', description: 'Manage users' },
  { code: 'permissions.manage', group: 'Admin', description: 'Assign permissions' },
  { code: 'settings.manage', group: 'Admin', description: 'Edit company settings' },
  { code: 'audit.view', group: 'Admin', description: 'View audit log' },
];

const ROLE_DEFAULTS: Record<RoleName, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map((p) => p.code),
  ADMIN: ALL_PERMISSIONS.map((p) => p.code),
  AGENT: [
    'invoice.create',
    'invoice.view.own',
    'invoice.discount',
    'customer.create',
    'customer.update',
    'product.view',
    'return.create',
    'payment.create',
    'visit.checkin',
    'tracking.submit',
    'attachment.upload',
  ],
};

async function main() {
  console.log('🌱  Seeding…');

  // 1. Permissions
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: { description: p.description, group: p.group },
    });
  }
  console.log(`✅ Permissions: ${ALL_PERMISSIONS.length}`);

  // 2. Roles + role permissions
  for (const roleName of Object.keys(ROLE_DEFAULTS) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, description: roleName },
      update: {},
    });
    const codes = ROLE_DEFAULTS[roleName];
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Roles');

  // 3. Default branch
  const branch = await prisma.branch.upsert({
    where: { code: 'BR1' },
    create: { code: 'BR1', name: 'Main Branch', address: 'HQ', invoiceSeq: 0 },
    update: {},
  });

  // 4. Settings
  await prisma.setting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName: 'My Field Sales Co.',
      companyNameAr: 'شركة المبيعات الميدانية',
      defaultCurrency: 'EGP',
      defaultLocale: 'ar',
    },
    update: {},
  });

  // 5. Users
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const adminPwd = await bcrypt.hash('Admin@123', rounds);
  const agentPwd = await bcrypt.hash('Agent@123', rounds);

  const superRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const agentRole = await prisma.role.findUniqueOrThrow({ where: { name: 'AGENT' } });

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    create: {
      username: 'superadmin',
      fullName: 'Super Admin',
      passwordHash: adminPwd,
      roleId: superRole.id,
      branchId: branch.id,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      fullName: 'Admin User',
      passwordHash: adminPwd,
      roleId: adminRole.id,
      branchId: branch.id,
    },
    update: {},
  });

  const agent = await prisma.user.upsert({
    where: { username: 'agent01' },
    create: {
      username: 'agent01',
      fullName: 'Sample Agent',
      phone: '+966500000001',
      passwordHash: agentPwd,
      roleId: agentRole.id,
      branchId: branch.id,
    },
    update: {},
  });

  // Default agent limits
  await prisma.agentLimits.upsert({
    where: { userId: agent.id },
    create: {
      userId: agent.id,
      maxDiscountPercent: 10,
      maxDiscountAmount: 500,
      maxInvoiceTotal: 50_000,
      preventBelowCost: true,
      allowEditAfterPrint: false,
      allowReturns: true,
    },
    update: {},
  });
  console.log('✅ Users (superadmin / admin / agent01)');

  // 6. Sample category + products
  const cat = await prisma.productCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Beverages', nameAr: 'مشروبات' },
    update: {},
  });

  const sampleProducts = [
    { sku: 'P-001', name: 'Bottled Water 500ml', nameAr: 'ماء معدني 500 مل', costPrice: 0.8, sellingPrice: 1.5, stockQty: 1000, unitType: 'piece' },
    { sku: 'P-002', name: 'Cola Can 330ml', nameAr: 'كولا 330 مل', costPrice: 1.2, sellingPrice: 2.5, stockQty: 500, unitType: 'piece' },
    { sku: 'P-003', name: 'Orange Juice 1L', nameAr: 'عصير برتقال 1 لتر', costPrice: 5.0, sellingPrice: 9.0, stockQty: 200, unitType: 'piece' },
    { sku: 'P-004', name: 'Coffee Beans 1kg', nameAr: 'حبوب قهوة 1 كجم', costPrice: 40, sellingPrice: 75, stockQty: 80, unitType: 'kg' },
  ];
  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: { ...p, categoryId: cat.id, taxPercent: 15 },
      update: {},
    });
  }
  console.log(`✅ Products: ${sampleProducts.length}`);

  // 7. Sample customers
  const sampleCustomers = [
    { code: 'C-001', storeName: 'Al Noor Market', contactName: 'Ahmed', phone: '+966500111111', address: 'Riyadh', latitude: 24.7136, longitude: 46.6753 },
    { code: 'C-002', storeName: 'Family Mart', contactName: 'Sara', phone: '+966500222222', address: 'Jeddah', latitude: 21.4858, longitude: 39.1925 },
    { code: 'C-003', storeName: 'City Grocer', contactName: 'Khalid', phone: '+966500333333', address: 'Dammam', latitude: 26.4207, longitude: 50.0888 },
  ];
  for (const c of sampleCustomers) {
    await prisma.customer.upsert({
      where: { code: c.code },
      create: { ...c, branchId: branch.id, createdById: agent.id },
      update: {},
    });
  }
  console.log(`✅ Customers: ${sampleCustomers.length}`);

  console.log('🌱  Seed complete.\n');
  console.log('   Login with:');
  console.log('     superadmin / Admin@123');
  console.log('     admin      / Admin@123');
  console.log('     agent01    / Agent@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
