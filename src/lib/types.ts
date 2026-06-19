export type AssociationStatus = 'active' | 'expired';
export type VoucherType = 'receipt' | 'disbursement';
export type AllowPayment = 'Yes' | 'No';
export type UserRole = 'admin' | 'client';

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  avatar_url?: string | null;
  created_at: Date | string;
}

export interface Association {
  id: number;
  association_name: string;
  username: string;
  password_hash: string;
  avatar_url?: string | null;
  is_first_login: boolean | number;
  subscription_start: string;
  subscription_end: string;
  status: AssociationStatus;
  created_at: Date | string;
}

export interface ChartOfAccount {
  id: number;
  association_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_code: string | null;
  allow_payment: AllowPayment;
  is_custom?: boolean | number;
  created_at?: Date | string;
}

export interface FinancialVoucher {
  id: number;
  association_id: number;
  voucher_type: VoucherType;
  voucher_number: string;
  voucher_date: string;
  total_amount: number;
  beneficiary_name: string | null;
  description: string | null;
  created_at?: Date | string;
}

export interface JournalEntry {
  id: number;
  voucher_id: number;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
  created_at?: Date | string;
}

export interface SafetyFinancialInput {
  id?: number;
  association_id: number;
  fiscal_year: number;
  total_expenses: number;
  admin_expenses: number;
  program_expenses: number;
  activity_admin_expenses: number;
  total_activity_expenses: number;
  sustainability_returns: number;
  sustainability_expenses: number;
  sustainability_assets: number;
  total_donations: number;
  fundraising_expenses: number;
  cash_equivalents: number;
  net_restricted_assets: number;
  net_endowment_cash: number;
  current_liabilities: number;
  net_current_cash_investments: number;
  estimated_annual_admin_expenses: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface AdminSession {
  role: 'admin';
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
}

export type AssociationUserRole = 'admin' | 'accountant' | 'auditor';
export type AssociationUserStatus = 'active' | 'inactive';

export interface ClientSession {
  role: 'client';
  id: number;
  username: string;
  association_name: string;
  avatar_url?: string | null;
  is_first_login: boolean;
  subscription_end: string;
  status: AssociationStatus;
  sub_user_id?: number;
  sub_user_role?: AssociationUserRole;
  is_sub_user?: boolean;
  display_name?: string;
}

export type AuthSession = AdminSession | ClientSession;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateAssociationRequest {
  association_name: string;
  subscription_start?: string;
  subscription_end?: string;
}

export interface UpdateAssociationRequest {
  association_name?: string;
  username?: string;
  password?: string;
  subscription_start?: string;
  subscription_end?: string;
  status?: AssociationStatus;
}

export interface UpdateAdminProfileRequest {
  username?: string;
  password?: string;
  name?: string;
}

export interface FirstLoginRequest {
  new_password: string;
}

export interface VoucherWithEntries extends FinancialVoucher {
  entries?: JournalEntry[];
}

export interface AssociationListItem extends Omit<Association, 'password_hash'> {
  days_remaining?: number;
}

export type EmployeeStatus = 'active' | 'inactive' | 'leave';

export interface Employee {
  id: number;
  association_id: number;
  name: string;
  job_title: string;
  id_number: string | null;
  hire_date: string | null;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  commission: number;
  gosi_percent: number;
  status: EmployeeStatus;
  gross_salary: number;
  gosi_amount: number;
  net_salary: number;
}

export interface PayrollEmployee extends Employee {
  disbursed: boolean;
  disbursed_at: string | null;
  voucher_id: number | null;
  voucher_number: string | null;
}

export interface EmployeeInput {
  name: string;
  job_title: string;
  id_number?: string;
  hire_date?: string;
  basic_salary: number;
  housing_allowance?: number;
  transport_allowance?: number;
  commission?: number;
  gosi_percent?: number;
  status?: EmployeeStatus;
}

export interface PayrollPreview {
  month: string;
  year: number;
  month_label: string;
  employees: PayrollEmployee[];
  total_gross: number;
  total_gosi: number;
  total_net: number;
  posted: boolean;
  disbursed_count: number;
  pending_count: number;
  all_disbursed: boolean;
}

export interface AssociationSettings {
  association_id: number;
  association_name: string;
  name_en: string | null;
  cr_number: string | null;
  license_number: string | null;
  founded_date: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  fiscal_year_start: number;
  current_fiscal_year: number;
  currency: string;
  journal_seq_start: number;
  stamp_url: string | null;
  logo_url: string | null;
}

export type BankAccountStatus = 'active' | 'inactive';

export interface BankAccount {
  id: number;
  association_id: number;
  description: string;
  bank_name: string;
  account_number: string;
  iban: string;
  account_owner: string | null;
  account_code: string;
  opening_balance: number;
  status: BankAccountStatus;
}

export interface AssociationUserView {
  id: number | 'primary';
  display_name: string;
  username: string;
  role: AssociationUserRole;
  role_label: string;
  permissions: string;
  status: AssociationUserStatus | 'active';
  is_primary: boolean;
}

export interface FiscalYearRecord {
  id: number;
  fiscal_year: number;
  closed_date: string;
  journal_count: number;
  total_income: number;
  total_expenses: number;
}

export interface FiscalStatus {
  current_fiscal_year: number;
  can_open_new: boolean;
  closed_years: FiscalYearRecord[];
}
