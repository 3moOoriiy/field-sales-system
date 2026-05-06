import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const ar = {
  app: { name: 'إدارة المبيعات الميدانية' },
  nav: {
    dashboard: 'لوحة المعلومات',
    agents: 'المندوبون',
    permissions: 'الصلاحيات',
    map: 'خريطة مباشرة',
    customers: 'العملاء',
    products: 'المنتجات',
    invoices: 'الفواتير',
    returns: 'المرتجعات',
    payments: 'التحصيلات',
    visits: 'الزيارات',
    reports: 'التقارير',
    settings: 'إعدادات',
    audit: 'سجل التدقيق',
  },
  actions: {
    new: 'جديد',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    search: 'بحث',
    refresh: 'تحديث',
    export: 'تصدير',
    logout: 'خروج',
    create: 'إنشاء',
  },
  status: {
    online: 'متصل',
    offline: 'غير متصل',
    loading: 'جارٍ التحميل…',
    empty: 'لا توجد بيانات',
    error: 'حدث خطأ',
  },
  fields: {
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    phone: 'الهاتف',
    role: 'الدور',
    branch: 'الفرع',
    storeName: 'اسم المحل',
    address: 'العنوان',
    code: 'الكود',
    sku: 'SKU',
    barcode: 'باركود',
    name: 'الاسم',
    nameAr: 'الاسم (عربي)',
    sellingPrice: 'سعر البيع',
    costPrice: 'سعر التكلفة',
    taxPercent: 'ضريبة %',
    stockQty: 'المخزون',
    unitType: 'الوحدة',
    invoiceNumber: 'رقم الفاتورة',
    customer: 'العميل',
    agent: 'المندوب',
    total: 'الإجمالي',
    paid: 'مدفوع',
    status: 'الحالة',
    date: 'التاريخ',
    notes: 'ملاحظات',
    balance: 'الرصيد',
  },
  kpi: {
    todaySales: 'مبيعات اليوم',
    todayInvoices: 'فواتير اليوم',
    totalReturns: 'المرتجعات',
    totalCollections: 'المحصّل',
    outstandingDebt: 'مديونيات قائمة',
    topAgents: 'أفضل المندوبين',
  },
};

const en: typeof ar = {
  app: { name: 'Field Sales Admin' },
  nav: {
    dashboard: 'Dashboard',
    agents: 'Agents',
    permissions: 'Permissions',
    map: 'Live Map',
    customers: 'Customers',
    products: 'Products',
    invoices: 'Invoices',
    returns: 'Returns',
    payments: 'Payments',
    visits: 'Visits',
    reports: 'Reports',
    settings: 'Settings',
    audit: 'Audit Log',
  },
  actions: {
    new: 'New',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    refresh: 'Refresh',
    export: 'Export',
    logout: 'Logout',
    create: 'Create',
  },
  status: {
    online: 'Online',
    offline: 'Offline',
    loading: 'Loading…',
    empty: 'No data',
    error: 'Error',
  },
  fields: {
    username: 'Username',
    password: 'Password',
    fullName: 'Full name',
    phone: 'Phone',
    role: 'Role',
    branch: 'Branch',
    storeName: 'Store name',
    address: 'Address',
    code: 'Code',
    sku: 'SKU',
    barcode: 'Barcode',
    name: 'Name',
    nameAr: 'Name (Arabic)',
    sellingPrice: 'Selling price',
    costPrice: 'Cost price',
    taxPercent: 'Tax %',
    stockQty: 'Stock',
    unitType: 'Unit',
    invoiceNumber: 'Invoice #',
    customer: 'Customer',
    agent: 'Agent',
    total: 'Total',
    paid: 'Paid',
    status: 'Status',
    date: 'Date',
    notes: 'Notes',
    balance: 'Balance',
  },
  kpi: {
    todaySales: 'Today\'s sales',
    todayInvoices: 'Today\'s invoices',
    totalReturns: 'Returns',
    totalCollections: 'Collections',
    outstandingDebt: 'Outstanding debt',
    topAgents: 'Top agents',
  },
};

export const SUPPORTED_LANGS = ['ar', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const initial: Lang = (() => {
  const saved = localStorage.getItem('lang') as Lang | null;
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  return 'ar';
})();

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDir(initial);

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
  localStorage.setItem('lang', lang);
  applyDir(lang);
}

function applyDir(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;
