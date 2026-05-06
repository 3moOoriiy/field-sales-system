/**
 * Mirror of backend permission codes. Update both sides when adding new perms.
 */
export interface PermissionDef {
  code: string;
  group: string;
  description: string;
  descriptionAr: string;
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Invoices
  { code: 'invoice.create',             group: 'Invoices', description: 'Create invoice',       descriptionAr: 'إنشاء فاتورة' },
  { code: 'invoice.update',             group: 'Invoices', description: 'Edit invoice',         descriptionAr: 'تعديل فاتورة' },
  { code: 'invoice.cancel',             group: 'Invoices', description: 'Cancel invoice',       descriptionAr: 'إلغاء فاتورة' },
  { code: 'invoice.view.own',           group: 'Invoices', description: 'View own invoices',    descriptionAr: 'عرض الفواتير الخاصة' },
  { code: 'invoice.view.all',           group: 'Invoices', description: 'View all invoices',    descriptionAr: 'عرض كل الفواتير' },
  { code: 'invoice.discount',           group: 'Invoices', description: 'Apply discount',       descriptionAr: 'تطبيق خصم' },
  { code: 'invoice.edit_after_print',   group: 'Invoices', description: 'Edit after print',     descriptionAr: 'تعديل بعد الطباعة' },

  // Customers
  { code: 'customer.create',            group: 'Customers', description: 'Create customer',     descriptionAr: 'إضافة عميل' },
  { code: 'customer.update',            group: 'Customers', description: 'Edit customer',       descriptionAr: 'تعديل عميل' },
  { code: 'customer.view.all',          group: 'Customers', description: 'View all customers',  descriptionAr: 'عرض كل العملاء' },

  // Products
  { code: 'product.view',               group: 'Products', description: 'View products',        descriptionAr: 'عرض المنتجات' },
  { code: 'product.manage',             group: 'Products', description: 'Manage products',      descriptionAr: 'إدارة المنتجات' },

  // Returns
  { code: 'return.create',              group: 'Returns', description: 'Create returns',        descriptionAr: 'إنشاء مرتجع' },
  { code: 'return.view.all',            group: 'Returns', description: 'View all returns',      descriptionAr: 'عرض كل المرتجعات' },

  // Payments
  { code: 'payment.create',             group: 'Payments', description: 'Record payment',       descriptionAr: 'تسجيل تحصيل' },
  { code: 'payment.view.all',           group: 'Payments', description: 'View all payments',    descriptionAr: 'عرض كل التحصيلات' },

  // Visits
  { code: 'visit.checkin',              group: 'Visits', description: 'Visit check-in',         descriptionAr: 'تسجيل دخول الزيارة' },
  { code: 'visit.assign',               group: 'Visits', description: 'Assign visit tasks',     descriptionAr: 'تعيين مهام زيارة' },
  { code: 'visit.view.all',             group: 'Visits', description: 'View all visits',        descriptionAr: 'عرض كل الزيارات' },

  // Tracking
  { code: 'tracking.submit',            group: 'Tracking', description: 'Submit GPS',           descriptionAr: 'إرسال الموقع' },
  { code: 'tracking.view',              group: 'Tracking', description: 'View map',             descriptionAr: 'عرض الخريطة' },

  // Reports
  { code: 'report.sales',               group: 'Reports', description: 'Sales reports',         descriptionAr: 'تقارير المبيعات' },
  { code: 'report.profit',              group: 'Reports', description: 'Profit reports',        descriptionAr: 'تقارير الأرباح' },
  { code: 'report.debts',               group: 'Reports', description: 'Debts reports',         descriptionAr: 'تقارير المديونيات' },
  { code: 'report.collections',         group: 'Reports', description: 'Collections reports',   descriptionAr: 'تقارير التحصيل' },

  // Attachments
  { code: 'attachment.upload',          group: 'Attachments', description: 'Upload attachments', descriptionAr: 'رفع المرفقات' },

  // Admin
  { code: 'user.manage',                group: 'Admin', description: 'Manage users',            descriptionAr: 'إدارة المستخدمين' },
  { code: 'permissions.manage',         group: 'Admin', description: 'Assign permissions',      descriptionAr: 'إسناد الصلاحيات' },
  { code: 'settings.manage',            group: 'Admin', description: 'Edit company settings',   descriptionAr: 'تعديل إعدادات الشركة' },
  { code: 'audit.view',                 group: 'Admin', description: 'View audit log',          descriptionAr: 'عرض سجل التدقيق' },
];

export const PERMISSION_GROUPS = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));
