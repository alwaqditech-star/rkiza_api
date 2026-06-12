import { NextResponse } from 'next/server';
import { requireClientSession, requireClientWrite } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { calcSafetyFromInput } from '@/lib/safety-indicators';
import { getSafetyInput, upsertSafetyInput } from '@/lib/safety-service';
export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const fiscalYear = Number(searchParams.get('fiscal_year') ?? new Date().getFullYear());

    const input = await getSafetyInput(session.id, fiscalYear);
    const results = input ? calcSafetyFromInput(input) : null;

    return NextResponse.json({
      success: true,
      data: { input, results },
    });
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
    const fiscalYear = Number(body.fiscal_year ?? new Date().getFullYear());

    const payload = {
      fiscal_year: fiscalYear,
      total_expenses: Number(body.total_expenses ?? 0),
      admin_expenses: Number(body.admin_expenses ?? 0),
      program_expenses: Number(body.program_expenses ?? 0),
      activity_admin_expenses: Number(body.activity_admin_expenses ?? 0),
      total_activity_expenses: Number(body.total_activity_expenses ?? 0),
      sustainability_returns: Number(body.sustainability_returns ?? 0),
      sustainability_expenses: Number(body.sustainability_expenses ?? 0),
      sustainability_assets: Number(body.sustainability_assets ?? 0),
      total_donations: Number(body.total_donations ?? 0),
      fundraising_expenses: Number(body.fundraising_expenses ?? 0),
      cash_equivalents: Number(body.cash_equivalents ?? 0),
      net_restricted_assets: Number(body.net_restricted_assets ?? 0),
      net_endowment_cash: Number(body.net_endowment_cash ?? 0),
      current_liabilities: Number(body.current_liabilities ?? 0),
      net_current_cash_investments: Number(body.net_current_cash_investments ?? 0),
      estimated_annual_admin_expenses: Number(
        body.estimated_annual_admin_expenses ?? 0,
      ),
    };

    await upsertSafetyInput(session.id, payload);
    const results = calcSafetyFromInput(payload);

    return NextResponse.json({
      success: true,
      message: 'تم حفظ المدخلات واحتساب المؤشرات',
      data: { input: payload, results },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    return NextResponse.json(
      { success: false, message: 'خطأ في حفظ المؤشرات', error: message },
      { status: 500 },
    );
  }
}
