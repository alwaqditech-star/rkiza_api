import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { createAssociationUser } from '../src/lib/association-users-service';
import { ensureCoaSeeded } from '../src/lib/coa-service';
import { createBankAccount, listBankAccounts } from '../src/lib/bank-service';
import { createEmployee, listEmployees } from '../src/lib/employee-service';
import { upsertAssociationSettings } from '../src/lib/org-settings-service';
import { postPayrollJournal } from '../src/lib/payroll-service';
import { upsertSafetyInput } from '../src/lib/safety-service';
import { execute, getPool, query } from '../src/lib/db';
import {
  createVoucherWithJournal,
  listVouchers,
  type CreateVoucherInput,
} from '../src/lib/vouchers';

const DEMO = {
  association_name: 'جمعية الخير التنموية',
  username: 'alkhair',
  password: 'demo123',
  name_en: 'Al-Khair Development Association',
  cr_number: '1010123456',
  license_number: 'LIC-2024-0088',
  founded_date: '2015-03-15',
  city: 'الرياض',
  address: 'حي النخيل، شارع الملك فهد، مبنى 12',
  phone: '0112345678',
  email: 'info@alkhair-demo.org',
  website: 'https://alkhair-demo.org',
  description:
    'جمعية غير ربحية تهتم بالبرامج التنموية والمساندة المجتمعية — حساب تجريبي للعرض.',
};

const EXTRA_EMPLOYEES = [
  {
    name: 'أحمد محمد العتيبي',
    job_title: 'محاسب',
    id_number: '1087654321',
    hire_date: '2022-01-01',
    basic_salary: 8000,
    housing_allowance: 2000,
    transport_allowance: 500,
    commission: 0,
    gosi_percent: 9,
    status: 'active' as const,
  },
  {
    name: 'سارة عبدالله القحطاني',
    job_title: 'مديرة البرامج',
    id_number: '1098765432',
    hire_date: '2021-06-15',
    basic_salary: 9500,
    housing_allowance: 2500,
    transport_allowance: 600,
    commission: 500,
    gosi_percent: 9,
    status: 'active' as const,
  },
  {
    name: 'خالد فهد الشمري',
    job_title: 'منسق ميداني',
    id_number: '1109876543',
    hire_date: '2023-04-01',
    basic_salary: 6500,
    housing_allowance: 1500,
    transport_allowance: 800,
    commission: 300,
    gosi_percent: 9,
    status: 'active' as const,
  },
  {
    name: 'نورة سعد الغامدي',
    job_title: 'أخصائية موارد بشرية',
    id_number: '1110987654',
    hire_date: '2020-09-10',
    basic_salary: 7200,
    housing_allowance: 1800,
    transport_allowance: 450,
    commission: 0,
    gosi_percent: 9,
    status: 'active' as const,
  },
  {
    name: 'عبدالرحمن يوسف الحربي',
    job_title: 'سائق',
    id_number: '1121098765',
    hire_date: '2024-01-20',
    basic_salary: 4200,
    housing_allowance: 800,
    transport_allowance: 1200,
    commission: 0,
    gosi_percent: 9,
    status: 'active' as const,
  },
  {
    name: 'ريم سلطان المطيري',
    job_title: 'مسؤولة علاقات مانحين',
    id_number: '1132109876',
    hire_date: '2022-11-05',
    basic_salary: 8800,
    housing_allowance: 2200,
    transport_allowance: 550,
    commission: 1200,
    gosi_percent: 9,
    status: 'active' as const,
  },
];

const EXTRA_BANKS = [
  {
    description: 'الحساب الرئيسي',
    bank_name: 'البنك الأهلي السعودي',
    account_number: '1234567890',
    iban: 'SA0380000000608010167519',
    account_owner: 'جمعية الخير التنموية',
    account_code: '11101001',
    opening_balance: 25000,
    status: 'active' as const,
  },
  {
    description: 'حساب التبرعات',
    bank_name: 'مصرف الراجحي',
    account_number: '9876543210',
    iban: 'SA1234567890123456789012',
    account_owner: 'جمعية الخير التنموية',
    account_code: '11101002',
    opening_balance: 85000,
    status: 'active' as const,
  },
  {
    description: 'حساب البرامج',
    bank_name: 'بنك الرياض',
    account_number: '5566778899',
    iban: 'SA9876543210987654321098',
    account_owner: 'جمعية الخير التنموية',
    account_code: '11101003',
    opening_balance: 42000,
    status: 'active' as const,
  },
];

const EXTRA_USERS = [
  {
    display_name: 'فاطمة المحاسبة',
    username: 'alkhair_acc',
    password: 'demo123',
    role: 'accountant' as const,
  },
  {
    display_name: 'عمر المراجع',
    username: 'alkhair_audit',
    password: 'demo123',
    role: 'auditor' as const,
  },
];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function voucherKey(input: Pick<CreateVoucherInput, 'voucherType' | 'ref' | 'purpose'>) {
  return `${input.voucherType}:${input.ref || input.purpose}`;
}

const DEMO_VOUCHERS: Array<Omit<CreateVoucherInput, 'associationId'>> = [
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(85),
    beneficiaryName: 'مؤسسة العطاء الخيرية',
    amount: 15000,
    accountCode: '31205001',
    purpose: 'تبرع لدعم برنامج كفالة الأسر',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-001',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(72),
    beneficiaryName: 'شركة نماء للاستثمار',
    amount: 50000,
    accountCode: '31205003',
    purpose: 'عائد استثمار وقفي',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-002',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(60),
    beneficiaryName: 'مجموعة أعمال الخير',
    amount: 25000,
    accountCode: '31205001',
    purpose: 'رعاة برنامج السلة الغذائية',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-003',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(45),
    beneficiaryName: 'محمد سعد الدوسري',
    amount: 5000,
    accountCode: '31205002',
    purpose: 'اشتراك سنوي في برنامج التبرعات',
    method: 'نقداً',
    ref: 'DEMO-R-004',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(38),
    beneficiaryName: 'فاطمة علي الزهراني',
    amount: 3000,
    accountCode: '31205008',
    purpose: 'رسوم دورة تدريبية',
    method: 'نقداً',
    ref: 'DEMO-R-005',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(28),
    beneficiaryName: 'بنك الخير التجاري',
    amount: 120000,
    accountCode: '31205001',
    purpose: 'منحة حكومية لدعم التشغيل',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-006',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(18),
    beneficiaryName: 'عبدالله الحربي',
    amount: 2000,
    accountCode: '31205007',
    purpose: 'إيرادات تأجير قاعة الجمعية',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-007',
  },
  {
    voucherType: 'receipt',
    voucherDate: daysAgo(8),
    beneficiaryName: 'مؤسسة الرحمة',
    amount: 18000,
    accountCode: '31205001',
    purpose: 'تبرع لبرنامج كفالة الأيتام',
    method: 'تحويل بنكي',
    ref: 'DEMO-R-008',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(70),
    beneficiaryName: 'موردو المواد الغذائية',
    amount: 22000,
    accountCode: '42102004',
    purpose: 'شراء سلال غذائية للأسر المحتاجة',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-001',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(55),
    beneficiaryName: 'شركة الاتصالات',
    amount: 4500,
    accountCode: '41203003',
    purpose: 'فاتورة اتصالات وإنترنت',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-002',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(40),
    beneficiaryName: 'أحمد محمد العتيبي',
    amount: 8500,
    accountCode: '41101001',
    purpose: 'صرف راتب شهر سابق',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-003',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(32),
    beneficiaryName: 'مكتب التصميم الإبداعي',
    amount: 6500,
    accountCode: '41204005',
    purpose: 'تصميم مطبوعات الحملة',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-004',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(22),
    beneficiaryName: 'أسر مستفيدة - كفالة',
    amount: 15000,
    accountCode: '42102001',
    purpose: 'صرف كفالات شهرية',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-005',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(14),
    beneficiaryName: 'شركة الصيانة المتكاملة',
    amount: 3200,
    accountCode: '41202002',
    purpose: 'صيانة مبنى الجمعية',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-006',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(6),
    beneficiaryName: 'سارة عبدالله القحطاني',
    amount: 9800,
    accountCode: '41101001',
    purpose: 'صرف راتب شهر الحالي',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-007',
  },
  {
    voucherType: 'disbursement',
    voucherDate: daysAgo(2),
    beneficiaryName: 'مؤسسة النقل السريع',
    amount: 2800,
    accountCode: '41102002',
    purpose: 'تذاكر سفر لبرنامج ميداني',
    method: 'تحويل بنكي',
    ref: 'DEMO-P-008',
  },
];

async function ensureAssociation(): Promise<number> {
  const existing = await query<RowDataPacket[]>(
    'SELECT id FROM associations WHERE username = ? LIMIT 1',
    [DEMO.username],
  );

  const passwordHash = await bcrypt.hash(DEMO.password, 10);

  if (existing.length > 0) {
    const id = Number(existing[0].id);
    await execute(
      `UPDATE associations
       SET association_name = ?, password_hash = ?, is_first_login = 0,
           subscription_start = CURDATE(),
           subscription_end = DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
           status = 'active'
       WHERE id = ?`,
      [DEMO.association_name, passwordHash, id],
    );
    console.log(`[OK] Association ready id=${id} (${DEMO.username})`);
    return id;
  }

  const result = await execute(
    `INSERT INTO associations
     (association_name, username, password_hash, is_first_login,
      subscription_start, subscription_end, status)
     VALUES (?, ?, ?, 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'active')`,
    [DEMO.association_name, DEMO.username, passwordHash],
  );

  console.log(`[OK] Created association id=${result.insertId} (${DEMO.username})`);
  return result.insertId;
}

async function employeeExists(associationId: number, idNumber: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    'SELECT id FROM employees WHERE association_id = ? AND id_number = ? LIMIT 1',
    [associationId, idNumber],
  );
  return rows.length > 0;
}

async function userExists(username: string): Promise<boolean> {
  const inAssoc = await query<RowDataPacket[]>(
    'SELECT id FROM associations WHERE username = ? LIMIT 1',
    [username],
  );
  if (inAssoc.length) return true;

  const inUsers = await query<RowDataPacket[]>(
    'SELECT id FROM association_users WHERE username = ? LIMIT 1',
    [username],
  );
  return inUsers.length > 0;
}

function previousMonth(year: number, month: number) {
  if (month > 1) return { year, month: month - 1 };
  return { year: year - 1, month: 12 };
}

async function seedAssociationData(associationId: number) {
  await ensureCoaSeeded(associationId);
  console.log('[OK] Chart of accounts ready');

  await upsertAssociationSettings(associationId, {
    association_name: DEMO.association_name,
    name_en: DEMO.name_en,
    cr_number: DEMO.cr_number,
    license_number: DEMO.license_number,
    founded_date: DEMO.founded_date,
    city: DEMO.city,
    address: DEMO.address,
    phone: DEMO.phone,
    email: DEMO.email,
    website: DEMO.website,
    description: DEMO.description,
    fiscal_year_start: 1,
    current_fiscal_year: new Date().getFullYear(),
    currency: 'SAR',
    journal_seq_start: 1,
  });
  console.log('[OK] Association settings saved');

  const banks = await listBankAccounts(associationId);
  const bankIbans = new Set(banks.map((bank) => bank.iban));
  let banksAdded = 0;
  for (const bank of EXTRA_BANKS) {
    if (bankIbans.has(bank.iban)) continue;
    await createBankAccount(associationId, bank);
    banksAdded += 1;
  }
  console.log(banksAdded ? `[OK] Added ${banksAdded} bank account(s)` : '[SKIP] Bank accounts complete');

  let employeesAdded = 0;
  for (const employee of EXTRA_EMPLOYEES) {
    if (await employeeExists(associationId, employee.id_number)) continue;
    await createEmployee(associationId, employee);
    employeesAdded += 1;
  }
  console.log(
    employeesAdded ? `[OK] Added ${employeesAdded} employee(s)` : '[SKIP] Employees complete',
  );

  let usersAdded = 0;
  for (const user of EXTRA_USERS) {
    if (await userExists(user.username)) continue;
    await createAssociationUser(associationId, user);
    usersAdded += 1;
  }
  console.log(usersAdded ? `[OK] Added ${usersAdded} sub-user(s)` : '[SKIP] Sub-users complete');

  const existingVouchers = await listVouchers(associationId);
  const existingRefs = new Set(
    existingVouchers.map((item) => item.meta.ref).filter(Boolean),
  );
  let vouchersAdded = 0;
  for (const voucher of DEMO_VOUCHERS) {
    if (voucher.ref && existingRefs.has(voucher.ref)) continue;
    if (!voucher.ref && existingRefs.has(voucherKey(voucher))) continue;

    await createVoucherWithJournal({ associationId, ...voucher });
    if (voucher.ref) existingRefs.add(voucher.ref);
    vouchersAdded += 1;
  }
  console.log(
    vouchersAdded ? `[OK] Added ${vouchersAdded} voucher(s)` : '[SKIP] Vouchers complete',
  );

  const allVouchers = await listVouchers(associationId);
  const receipts = allVouchers.filter((item) => item.voucher_type === 'receipt');
  const payments = allVouchers.filter((item) => item.voucher_type === 'disbursement');
  const totalDonations = receipts.reduce((sum, item) => sum + item.total_amount, 0);
  const totalExpenses = payments.reduce((sum, item) => sum + item.total_amount, 0);
  const year = new Date().getFullYear();

  await upsertSafetyInput(associationId, {
    fiscal_year: year,
    total_expenses: totalExpenses * 1.15,
    admin_expenses: totalExpenses * 0.28,
    program_expenses: totalExpenses * 0.72,
    activity_admin_expenses: totalExpenses * 0.12,
    total_activity_expenses: totalExpenses * 0.85,
    sustainability_returns: 12000,
    sustainability_expenses: 4500,
    sustainability_assets: 180000,
    total_donations: totalDonations,
    fundraising_expenses: 8500,
    cash_equivalents: 95000,
    net_restricted_assets: 42000,
    net_endowment_cash: 65000,
    current_liabilities: 18000,
    net_current_cash_investments: 78000,
    estimated_annual_admin_expenses: totalExpenses * 0.3,
  });
  console.log('[OK] Safety indicators data saved');

  const now = new Date();
  const month1 = previousMonth(now.getFullYear(), now.getMonth() + 1);
  const month2 = previousMonth(month1.year, month1.month);
  const payrollTargets = [month2, month1];

  let payrollPosted = 0;
  for (const item of payrollTargets) {
    try {
      await postPayrollJournal(
        associationId,
        String(item.month).padStart(2, '0'),
        item.year,
      );
      payrollPosted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('مسبقاً')) {
        console.log(`[WARN] Payroll ${item.month}/${item.year}: ${message}`);
      }
    }
  }
  console.log(
    payrollPosted
      ? `[OK] Posted ${payrollPosted} payroll run(s)`
      : '[SKIP] Payroll runs already posted or unavailable',
  );
}

async function main() {
  const associationId = await ensureAssociation();
  await seedAssociationData(associationId);

  const vouchers = await listVouchers(associationId);
  const employees = await listEmployees(associationId);
  const banks = await listBankAccounts(associationId);

  console.log('\n--- Demo association ready ---');
  console.log(`Name:       ${DEMO.association_name}`);
  console.log(`Username:   ${DEMO.username}`);
  console.log(`Password:   ${DEMO.password}`);
  console.log(`Sub-users:  alkhair_acc / alkhair_audit (demo123)`);
  console.log(`Employees:  ${employees.length}`);
  console.log(`Banks:      ${banks.length}`);
  console.log(`Vouchers:   ${vouchers.length}`);
  console.log('Login at:   https://rkiza-pro.vercel.app');
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ERROR]', message);
    process.exit(1);
  })
  .finally(async () => {
    await getPool().end();
  });
