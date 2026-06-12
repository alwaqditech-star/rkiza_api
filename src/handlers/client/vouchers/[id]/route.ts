import { NextResponse } from 'next/server';
import { requireClientSession, requireClientDelete } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { deleteVoucher, getVoucherById } from '@/lib/vouchers';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireClientSession();
    const { id } = await context.params;
    const voucherId = Number(id);

    if (!voucherId) {
      return NextResponse.json(
        { success: false, message: 'معرف السند غير صالح' },
        { status: 400 },
      );
    }

    const data = await getVoucherById(session.id, voucherId);
    if (!data) {
      return NextResponse.json(
        { success: false, message: 'السند غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 401 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireClientDelete();
    const { id } = await context.params;
    const voucherId = Number(id);

    if (!voucherId) {
      return NextResponse.json(
        { success: false, message: 'معرف السند غير صالح' },
        { status: 400 },
      );
    }

    const deleted = await deleteVoucher(session.id, voucherId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'السند غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف السند بنجاح',
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    return NextResponse.json(
      { success: false, message: 'خطأ في حذف السند', error: message },
      { status: 500 },
    );
  }
}
