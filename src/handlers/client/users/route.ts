import { NextResponse } from 'next/server';
import { requireClientSession, requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import {
  createAssociationUser,
  listAssociationUsers,
} from '@/lib/association-users-service';
import type { AssociationUserRole, AssociationUserStatus } from '@/lib/types';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await listAssociationUsers(session.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClientSettings();
    const body = await request.json();

    const displayName = String(body.display_name ?? '').trim();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');

    if (!displayName || !username || password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'الاسم واسم المستخدم وكلمة مرور (6+ أحرف) مطلوبة' },
        { status: 400 },
      );
    }

    const id = await createAssociationUser(session.id, {
      display_name: displayName,
      username,
      password,
      role: (body.role ?? 'accountant') as AssociationUserRole,
      status: (body.status ?? 'active') as AssociationUserStatus,
    });

    return NextResponse.json({
      success: true,
      message: 'تم إضافة المستخدم',
      data: { id },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الإضافة';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
