import { NextResponse } from 'next/server';
import { requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import {
  deleteAssociationUser,
  updateAssociationUser,
} from '@/lib/association-users-service';
import type { AssociationUserRole, AssociationUserStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireClientSettings();
    const { id } = await context.params;
    const body = await request.json();

    const updated = await updateAssociationUser(session.id, Number(id), {
      display_name: String(body.display_name ?? '').trim(),
      username: String(body.username ?? '').trim(),
      password: String(body.password ?? '') || undefined,
      role: (body.role ?? 'accountant') as AssociationUserRole,
      status: (body.status ?? 'active') as AssociationUserStatus,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم تحديث المستخدم' });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل التحديث';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireClientSettings();
    const { id } = await context.params;
    const deleted = await deleteAssociationUser(session.id, Number(id));

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم حذف المستخدم' });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الحذف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
