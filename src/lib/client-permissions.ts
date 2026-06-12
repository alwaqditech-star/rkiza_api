import type { AssociationUserRole, ClientSession } from '@/lib/types';

export type ClientAccessLevel = 'read' | 'write' | 'settings';

export interface ClientPermissions {
  roleLabel: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canSettings: boolean;
}

const SETTINGS_PREFIXES = [
  '/client/org-settings',
  '/client/coa-manage',
  '/client/banks',
  '/client/users',
  '/client/fiscal',
];

const WRITE_PREFIXES = [
  '/client/je',
  '/client/vouchers',
  '/client/employees',
  '/client/payroll',
];

function rolePermissions(role: AssociationUserRole): ClientPermissions {
  if (role === 'admin') {
    return {
      roleLabel: 'مدير النظام',
      canRead: true,
      canWrite: true,
      canDelete: true,
      canSettings: true,
    };
  }

  if (role === 'accountant') {
    return {
      roleLabel: 'محاسب',
      canRead: true,
      canWrite: true,
      canDelete: false,
      canSettings: false,
    };
  }

  return {
    roleLabel: 'مراجع داخلي',
    canRead: true,
    canWrite: false,
    canDelete: false,
    canSettings: false,
  };
}

export function getClientPermissions(session: ClientSession): ClientPermissions {
  if (!session.is_sub_user) {
    return {
      roleLabel: 'مدير الجمعية',
      canRead: true,
      canWrite: true,
      canDelete: true,
      canSettings: true,
    };
  }

  return rolePermissions(session.sub_user_role ?? 'auditor');
}

export function getPathAccessLevel(pathname: string): ClientAccessLevel {
  if (SETTINGS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'settings';
  }
  if (WRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'write';
  }
  return 'read';
}

export function canAccessClientPath(
  session: ClientSession,
  pathname: string,
): boolean {
  const permissions = getClientPermissions(session);
  const level = getPathAccessLevel(pathname);

  if (level === 'settings') return permissions.canSettings;
  if (level === 'write') return permissions.canWrite;
  return permissions.canRead;
}

export function permissionDeniedMessage(level: ClientAccessLevel): string {
  if (level === 'settings') {
    return 'ليس لديك صلاحية الوصول إلى إعدادات النظام';
  }
  if (level === 'write') {
    return 'ليس لديك صلاحية إجراء عمليات الإدخال أو التعديل';
  }
  return 'ليس لديك صلاحية الوصول إلى هذه الصفحة';
}
