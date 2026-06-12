import { NextResponse } from 'next/server';
import { requireClientSession, requireClientWrite } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { getPayrollPreview, postPayrollJournal } from '@/lib/payroll-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? String(new Date().getMonth() + 1).padStart(2, '0');
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());

    const data = await getPayrollPreview(session.id, month, year);
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
    const session = await requireClientWrite();
    const body = await request.json();
    const month = String(body.month ?? '').padStart(2, '0');
    const year = Number(body.year ?? new Date().getFullYear());

    if (!month || !year) {
      return NextResponse.json(
        { success: false, message: 'الشهر والسنة مطلوبان' },
        { status: 400 },
      );
    }

    const result = await postPayrollJournal(session.id, month, year);
    return NextResponse.json({
      success: true,
      message: `تم ترحيل قيد ${result.description} بنجاح`,
      data: result,
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل ترحيل المسير';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
