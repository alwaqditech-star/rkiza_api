import { NextResponse } from 'next/server';
import { requireClientSession, requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { addCoaAccount, listCoaAccounts } from '@/lib/coa-service';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await listCoaAccounts(session.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    if (message.includes('Unauthorized') || message.includes('صلاحية')) {
      return NextResponse.json(
        { success: false, message: 'صلاحية الجمعية مطلوبة' },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, message: message || 'تعذّر تحميل الدليل المحاسبي' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClientSettings();
    const body = await request.json();

    const accountCode = body.account_code as string;
    const accountName = body.account_name as string;
    const accountType = body.account_type as string;

    if (!accountCode || !accountName || !accountType) {
      return NextResponse.json(
        { success: false, message: 'رمز الحساب واسمه ونوعه مطلوبة' },
        { status: 400 },
      );
    }

    const id = await addCoaAccount(session.id, {
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      parent_code: body.parent_code ?? null,
      allow_payment: body.allow_payment ?? 'No',
      is_custom: true,
    });

    return NextResponse.json({
      success: true,
      message: 'تمت إضافة الحساب بنجاح',
      data: { id },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    if (message.includes('Duplicate') || message.includes('uq_coa_association_code')) {
      return NextResponse.json(
        { success: false, message: 'رمز الحساب موجود مسبقاً في الدليل' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: message || 'خطأ في إضافة الحساب' },
      { status: 500 },
    );
  }
}
