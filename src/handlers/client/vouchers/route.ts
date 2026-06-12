import { NextResponse } from 'next/server';
import { requireClientSession, requireClientWrite } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { createVoucherWithJournal, listVouchers } from '@/lib/vouchers';
import type { VoucherType } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as VoucherType | null;

    const data = await listVouchers(
      session.id,
      type === 'receipt' || type === 'disbursement' ? type : undefined,
    );

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClientWrite();
    const body = await request.json();

    const voucherType = body.voucher_type as VoucherType;
    const voucherDate = body.voucher_date as string;
    const beneficiaryName = body.beneficiary_name as string;
    const amount = Number(body.amount);
    const accountCode = body.account_code as string;
    const purpose = body.purpose as string;

    if (
      !voucherType ||
      !voucherDate ||
      !beneficiaryName ||
      !accountCode ||
      !purpose ||
      !amount ||
      amount <= 0
    ) {
      return NextResponse.json(
        { success: false, message: 'يرجى تعبئة الحقول المطلوبة' },
        { status: 400 },
      );
    }

    if (voucherType !== 'receipt' && voucherType !== 'disbursement') {
      return NextResponse.json(
        { success: false, message: 'نوع السند غير صالح' },
        { status: 400 },
      );
    }

    const id = await createVoucherWithJournal({
      associationId: session.id,
      voucherType,
      voucherDate,
      beneficiaryName,
      amount,
      accountCode,
      purpose,
      method: body.method,
      ref: body.ref,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ السند بنجاح',
      data: { id },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    return NextResponse.json(
      { success: false, message: 'خطأ في حفظ السند', error: message },
      { status: 500 },
    );
  }
}
