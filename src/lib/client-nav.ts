import type { TablerIcon } from '@tabler/icons-react';
import type { ClientAccessLevel } from '@/lib/client-permissions';
import { getClientPermissions } from '@/lib/client-permissions';
import type { ClientSession } from '@/lib/types';
import {
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconBooks,
  IconBuildingBank,
  IconBuildingCommunity,
  IconCalendarMonth,
  IconCalendarStats,
  IconCash,
  IconDashboard,
  IconFileText,
  IconFiles,
  IconHeart,
  IconListTree,
  IconNotebook,
  IconPencil,
  IconReportMoney,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';

export interface ClientNavLink {
  kind: 'link';
  href: string;
  label: string;
  icon: TablerIcon;
  section?: string;
  mobileNav?: boolean;
  access?: ClientAccessLevel;
}

export interface ClientNavGroup {
  kind: 'group';
  id: string;
  label: string;
  icon: TablerIcon;
  section?: string;
  access?: ClientAccessLevel;
  children: ClientNavLink[];
}

export type ClientNavEntry = ClientNavLink | ClientNavGroup;

/** @deprecated Use ClientNavLink — kept for compatibility */
export interface ClientNavItem {
  href: string;
  label: string;
  icon: TablerIcon;
  section?: string;
  mobileNav?: boolean;
  access?: ClientAccessLevel;
}

const VOUCHER_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/vouchers/receipts',
    label: 'سندات القبض',
    icon: IconArrowDownCircle,
    mobileNav: true,
    access: 'write',
  },
  {
    kind: 'link',
    href: '/client/vouchers/payments',
    label: 'سندات الصرف',
    icon: IconArrowUpCircle,
    mobileNav: true,
    access: 'write',
  },
];

const JOURNAL_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/je',
    label: 'قيد اليومية',
    icon: IconPencil,
    mobileNav: true,
    access: 'write',
  },
  {
    kind: 'link',
    href: '/client/jbook',
    label: 'دفتر اليومية',
    icon: IconNotebook,
  },
];

const LEDGER_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/ledger',
    label: 'دفتر الأستاذ العام',
    icon: IconBooks,
  },
  {
    kind: 'link',
    href: '/client/ledger-monthly',
    label: 'الأستاذ الشهري',
    icon: IconCalendarMonth,
  },
  {
    kind: 'link',
    href: '/client/trial',
    label: 'ميزان المراجعة',
    icon: IconScale,
  },
  {
    kind: 'link',
    href: '/client/statement',
    label: 'كشف الحساب',
    icon: IconFileText,
  },
];

const REPORT_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/rep-donations',
    label: 'تقرير التبرعات',
    icon: IconHeart,
  },
  {
    kind: 'link',
    href: '/client/rep-expenses',
    label: 'تقرير المصروفات',
    icon: IconReportMoney,
  },
  {
    kind: 'link',
    href: '/client/indicators',
    label: 'السلامة المالية',
    icon: IconShieldCheck,
  },
];

const PAYROLL_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/employees',
    label: 'سجلات الموظفين',
    icon: IconUsersGroup,
    access: 'write',
  },
  {
    kind: 'link',
    href: '/client/payroll',
    label: 'مسير الرواتب',
    icon: IconCash,
    access: 'write',
  },
];

const SETTINGS_LINKS: ClientNavLink[] = [
  {
    kind: 'link',
    href: '/client/org-settings',
    label: 'بيانات الجمعية',
    icon: IconBuildingCommunity,
    access: 'settings',
  },
  {
    kind: 'link',
    href: '/client/coa-manage',
    label: 'إدارة الدليل',
    icon: IconListTree,
    access: 'settings',
  },
  {
    kind: 'link',
    href: '/client/banks',
    label: 'الحسابات البنكية',
    icon: IconBuildingBank,
    access: 'settings',
  },
  {
    kind: 'link',
    href: '/client/users',
    label: 'المستخدمون',
    icon: IconUsers,
    access: 'settings',
  },
  {
    kind: 'link',
    href: '/client/fiscal',
    label: 'السنة المالية',
    icon: IconCalendarStats,
    access: 'settings',
  },
];

export const CLIENT_NAV_ENTRIES: ClientNavEntry[] = [
  { kind: 'link', href: '/client', label: 'لوحة التحكم', icon: IconDashboard, section: 'الرئيسية', mobileNav: true },
  { kind: 'link', href: '/client/coa', label: 'الدليل المحاسبي', icon: IconListTree, section: 'الرئيسية' },
  {
    kind: 'group',
    id: 'documents',
    label: 'مستندات',
    icon: IconFiles,
    access: 'write',
    children: VOUCHER_LINKS,
  },
  {
    kind: 'group',
    id: 'journals',
    label: 'القيود المحاسبية',
    icon: IconPencil,
    children: JOURNAL_LINKS,
  },
  {
    kind: 'group',
    id: 'ledgers',
    label: 'الدفاتر المالية',
    icon: IconBooks,
    children: LEDGER_LINKS,
  },
  {
    kind: 'group',
    id: 'reports',
    label: 'التقارير',
    icon: IconReportMoney,
    children: REPORT_LINKS,
  },
  {
    kind: 'group',
    id: 'payroll',
    label: 'الرواتب',
    icon: IconCash,
    access: 'write',
    children: PAYROLL_LINKS,
  },
  {
    kind: 'group',
    id: 'settings',
    label: 'الإعدادات',
    icon: IconSettings,
    access: 'settings',
    children: SETTINGS_LINKS,
  },
];

function flattenNavLinks(entries: ClientNavEntry[]): ClientNavLink[] {
  return entries.flatMap((entry) =>
    entry.kind === 'link' ? [entry] : entry.children,
  );
}

/** Flat list of all links — for page title lookup and legacy use */
export const CLIENT_NAV: ClientNavItem[] = flattenNavLinks(CLIENT_NAV_ENTRIES).map(
  ({ kind: _kind, ...item }) => item,
);

function canAccessNavItem(
  level: ClientAccessLevel | undefined,
  perms: ReturnType<typeof getClientPermissions>,
): boolean {
  const access = level ?? 'read';
  if (access === 'settings') return perms.canSettings;
  if (access === 'write') return perms.canWrite;
  return perms.canRead;
}

export function getClientPageTitle(pathname: string): string {
  if (pathname === '/client/first-login') return 'تغيير كلمة المرور';
  const exact = CLIENT_NAV.find((item) => item.href === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith('/client/vouchers/receipts')) return 'سندات القبض';
  if (pathname.startsWith('/client/vouchers/payments')) return 'سندات الصرف';
  return 'لوحة التحكم';
}

export function getClientPageIcon(pathname: string): TablerIcon {
  const item = CLIENT_NAV.find((nav) => nav.href === pathname);
  if (item) return item.icon;

  if (pathname.startsWith('/client/vouchers/receipts')) {
    return VOUCHER_LINKS[0].icon;
  }
  if (pathname.startsWith('/client/vouchers/payments')) {
    return VOUCHER_LINKS[1].icon;
  }

  for (const links of [
    JOURNAL_LINKS,
    LEDGER_LINKS,
    REPORT_LINKS,
    PAYROLL_LINKS,
    SETTINGS_LINKS,
  ]) {
    const match = links.find(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
    );
    if (match) return match.icon;
  }

  return IconDashboard;
}

export function filterClientNav(session: ClientSession): ClientNavEntry[] {
  const perms = getClientPermissions(session);
  const result: ClientNavEntry[] = [];

  for (const entry of CLIENT_NAV_ENTRIES) {
    if (entry.kind === 'link') {
      if (canAccessNavItem(entry.access, perms)) result.push(entry);
      continue;
    }

    const children = entry.children.filter((child) =>
      canAccessNavItem(child.access ?? entry.access, perms),
    );
    if (children.length > 0) result.push({ ...entry, children });
  }

  return result;
}
