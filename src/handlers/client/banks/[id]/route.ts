import { NextResponse } from 'next/server';
import { requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { deleteBankAccount, updateBankAccount } from '@/lib/bank-service';
import type { BankAccountStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireClientSettings();
    const { id } = await context.params;
    const body = await request.json();

    const updated = await updateBankAccount(session.id, Number(id), {
      description: String(body.description ?? '').trim(),
      bank_name: String(body.bank_name ?? '').trim(),
      account_number: String(body.account_number ?? '').trim(),
      iban: String(body.iban ?? '').trim(),
      account_owner: String(body.account_owner ?? '').trim() || null,
      account_code: String(body.account_code ?? '11101001'),
      opening_balance: Number(body.opening_balance ?? 0),
      status: (body.status ?? 'active') as BankAccountStatus,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'الحساب غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم تحديث الحساب البنكي' });
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
    const deleted = await deleteBankAccount(session.id, Number(id));

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'الحساب غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'تم حذف الحساب البنكي' });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الحذف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
