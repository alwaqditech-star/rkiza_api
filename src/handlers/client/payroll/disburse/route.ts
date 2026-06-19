import { NextResponse } from '../../../../shims/next-server';
import { requireClientWrite } from '../../../../lib/auth';
import { handleClientApiError } from '../../../../lib/client-api-error';
import { disburseEmployeePayroll } from '../../../../lib/payroll-service';

export async function POST(request: Request) {
  try {
    const session = await requireClientWrite();
    const body = (await request.json()) as Record<string, unknown>;
    const employeeId = Number(body.employee_id);
    const month = String(body.month ?? '').padStart(2, '0');
    const year = Number(body.year ?? new Date().getFullYear());
    const paymentAccountCode = body.payment_account_code
      ? String(body.payment_account_code)
      : undefined;

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { success: false, message: 'بيانات الصرف غير مكتملة' },
        { status: 400 },
      );
    }

    const result = await disburseEmployeePayroll({
      associationId: session.id,
      employeeId,
      month,
      year,
      paymentAccountCode,
    });

    return NextResponse.json({
      success: true,
      message: `تم صرف راتب الموظف — سند ${result.voucherNumber}`,
      data: result,
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل صرف الراتب';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
