import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import type {
  AssociationUserRole,
  AssociationUserStatus,
  AssociationUserView,
} from '@/lib/types';

interface UserRow extends RowDataPacket {
  id: number;
  display_name: string;
  username: string;
  role: AssociationUserRole;
  status: AssociationUserStatus;
}

interface PrimaryRow extends RowDataPacket {
  association_name: string;
  username: string;
  status: 'active' | 'expired';
}

const ROLE_LABELS: Record<AssociationUserRole, string> = {
  admin: 'مدير النظام',
  accountant: 'محاسب',
  auditor: 'مراجع داخلي',
};

export function rolePermissions(role: AssociationUserRole): string {
  if (role === 'admin') return 'قراءة · كتابة · حذف · إعدادات';
  if (role === 'accountant') return 'قراءة · كتابة';
  return 'قراءة فقط';
}

function isMissingUsersTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('association_users') || message.includes("doesn't exist");
}

export async function listAssociationUsers(
  associationId: number,
): Promise<AssociationUserView[]> {
  const primaryRows = await query<PrimaryRow[]>(
    'SELECT association_name, username, status FROM associations WHERE id = ?',
    [associationId],
  );
  const primary = primaryRows[0];
  const users: AssociationUserView[] = [
    {
      id: 'primary',
      display_name: primary?.association_name ?? 'مدير الجمعية',
      username: primary?.username ?? '',
      role: 'admin',
      role_label: ROLE_LABELS.admin,
      permissions: rolePermissions('admin'),
      status: primary?.status === 'expired' ? 'inactive' : 'active',
      is_primary: true,
    },
  ];

  try {
    const rows = await query<UserRow[]>(
      `SELECT id, display_name, username, role, status
       FROM association_users
       WHERE association_id = ?
       ORDER BY display_name`,
      [associationId],
    );
    rows.forEach((row) => {
      users.push({
        id: row.id,
        display_name: row.display_name,
        username: row.username,
        role: row.role,
        role_label: ROLE_LABELS[row.role],
        permissions: rolePermissions(row.role),
        status: row.status,
        is_primary: false,
      });
    });
  } catch (error) {
    if (!isMissingUsersTable(error)) throw error;
  }

  return users;
}

export async function createAssociationUser(
  associationId: number,
  input: {
    display_name: string;
    username: string;
    password: string;
    role: AssociationUserRole;
    status?: AssociationUserStatus;
  },
): Promise<number> {
  const duplicateAssoc = await query<RowDataPacket[]>(
    'SELECT id FROM associations WHERE username = ?',
    [input.username],
  );
  if (duplicateAssoc.length) {
    throw new Error('اسم المستخدم مستخدم مسبقاً');
  }

  try {
    const result = await execute(
      `INSERT INTO association_users
       (association_id, display_name, username, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        associationId,
        input.display_name,
        input.username,
        await hashPassword(input.password),
        input.role,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Duplicate')) {
      throw new Error('اسم المستخدم مستخدم مسبقاً');
    }
    if (isMissingUsersTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function updateAssociationUser(
  associationId: number,
  userId: number,
  input: {
    display_name: string;
    username: string;
    password?: string;
    role: AssociationUserRole;
    status: AssociationUserStatus;
  },
): Promise<boolean> {
  const duplicateAssoc = await query<RowDataPacket[]>(
    'SELECT id FROM associations WHERE username = ? AND id != ?',
    [input.username, associationId],
  );
  if (duplicateAssoc.length) {
    throw new Error('اسم المستخدم مستخدم مسبقاً');
  }

  try {
    if (input.password) {
      const result = await execute(
        `UPDATE association_users SET
           display_name = ?, username = ?, password_hash = ?, role = ?, status = ?
         WHERE id = ? AND association_id = ?`,
        [
          input.display_name,
          input.username,
          await hashPassword(input.password),
          input.role,
          input.status,
          userId,
          associationId,
        ],
      );
      return result.affectedRows > 0;
    }

    const result = await execute(
      `UPDATE association_users SET
         display_name = ?, username = ?, role = ?, status = ?
       WHERE id = ? AND association_id = ?`,
      [
        input.display_name,
        input.username,
        input.role,
        input.status,
        userId,
        associationId,
      ],
    );
    return result.affectedRows > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Duplicate')) {
      throw new Error('اسم المستخدم مستخدم مسبقاً');
    }
    if (isMissingUsersTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function deleteAssociationUser(
  associationId: number,
  userId: number,
): Promise<boolean> {
  try {
    const result = await execute(
      'DELETE FROM association_users WHERE id = ? AND association_id = ?',
      [userId, associationId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingUsersTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}
