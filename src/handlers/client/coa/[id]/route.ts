import { NextResponse } from 'next/server';
import { requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { deleteCoaAccount, updateCoaAccount } from '@/lib/coa-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireClientSettings();
    const { id } = await context.params;
    const body = await request.json();
    const accountName = String(body.account_name ?? '').trim();

    if (!accountName) {
      return NextResponse.json(
        { success: false, message: 'اسم الحساب مطلوب' },
        { status: 400 },
      );
    }

    const updated = await updateCoaAccount(session.id, Number(id), {
      account_name: accountName,
      allow_payment: body.allow_payment ?? 'No',
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'لا يمكن تعديل هذا الحساب' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم تحديث الحساب' });
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
    const deleted = await deleteCoaAccount(session.id, Number(id));

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'لا يمكن حذف هذا الحساب' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم حذف الحساب' });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الحذف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
