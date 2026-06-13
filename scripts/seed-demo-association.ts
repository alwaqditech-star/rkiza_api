import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { ensureCoaSeeded } from '../src/lib/coa-service';
import { createBankAccount, listBankAccounts } from '../src/lib/bank-service';
import { createEmployee, listEmployees } from '../src/lib/employee-service';
import { upsertAssociationSettings } from '../src/lib/org-settings-service';
import { execute, getPool, query } from '../src/lib/db';
import { createVoucherWithJournal, listVouchers } from '../src/lib/vouchers';

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

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

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
    console.log(`[OK] Updated association id=${id} (${DEMO.username})`);
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
  if (!banks.length) {
    await createBankAccount(associationId, {
      description: 'الحساب الرئيسي',
      bank_name: 'البنك الأهلي السعودي',
      account_number: '1234567890',
      iban: 'SA0380000000608010167519',
      account_owner: DEMO.association_name,
      account_code: '11101001',
      opening_balance: 25000,
      status: 'active',
    });
    console.log('[OK] Bank account added');
  } else {
    console.log('[SKIP] Bank account already exists');
  }

  const employees = await listEmployees(associationId);
  if (!employees.length) {
    await createEmployee(associationId, {
      name: 'أحمد محمد العتيبي',
      job_title: 'محاسب',
      id_number: '1087654321',
      hire_date: '2022-01-01',
      basic_salary: 8000,
      housing_allowance: 2000,
      transport_allowance: 500,
      commission: 0,
      gosi_percent: 9,
      status: 'active',
    });
    await createEmployee(associationId, {
      name: 'سارة عبدالله القحطاني',
      job_title: 'مديرة البرامج',
      id_number: '1098765432',
      hire_date: '2021-06-15',
      basic_salary: 9500,
      housing_allowance: 2500,
      transport_allowance: 600,
      commission: 500,
      gosi_percent: 9,
      status: 'active',
    });
    console.log('[OK] Sample employees added');
  } else {
    console.log('[SKIP] Employees already exist');
  }

  const vouchers = await listVouchers(associationId);
  if (!vouchers.length) {
    await createVoucherWithJournal({
      associationId,
      voucherType: 'receipt',
      voucherDate: daysAgo(12),
      beneficiaryName: 'مؤسسة العطاء الخيرية',
      amount: 15000,
      accountCode: '31205001',
      purpose: 'تبرع لدعم برنامج كفالة الأسر',
      method: 'تحويل بنكي',
      ref: 'TRX-2025-001',
    });
    await createVoucherWithJournal({
      associationId,
      voucherType: 'receipt',
      voucherDate: daysAgo(5),
      beneficiaryName: 'محمد سعد الدوسري',
      amount: 5000,
      accountCode: '31205002',
      purpose: 'اشتراك سنوي في برنامج التبرعات',
      method: 'نقداً',
    });
    await createVoucherWithJournal({
      associationId,
      voucherType: 'disbursement',
      voucherDate: daysAgo(3),
      beneficiaryName: 'أحمد محمد العتيبي',
      amount: 8500,
      accountCode: '41101001',
      purpose: 'صرف راتب شهر الحالي',
      method: 'تحويل بنكي',
    });
    console.log('[OK] Sample vouchers added');
  } else {
    console.log('[SKIP] Vouchers already exist');
  }
}

async function main() {
  const associationId = await ensureAssociation();
  await seedAssociationData(associationId);

  console.log('\n--- Demo association ready ---');
  console.log(`Name:     ${DEMO.association_name}`);
  console.log(`Username: ${DEMO.username}`);
  console.log(`Password: ${DEMO.password}`);
  console.log('Login at: https://rkiza-pro.vercel.app');
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
