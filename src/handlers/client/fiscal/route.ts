import { NextResponse } from 'next/server';
import { requireClientSession, requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import {
  closeFiscalYear,
  getFiscalStatus,
  openNewFiscalYear,
} from '@/lib/fiscal-service';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await getFiscalStatus(session.id);
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
    const action = String(body.action ?? '');

    if (action === 'close') {
      await closeFiscalYear(session.id);
      const data = await getFiscalStatus(session.id);
      return NextResponse.json({
        success: true,
        message: 'تم إقفال السنة المالية بنجاح',
        data,
      });
    }

    if (action === 'open') {
      const newYear = Number(body.year);
      if (!newYear) {
        return NextResponse.json(
          { success: false, message: 'أدخل سنة مالية صحيحة' },
          { status: 400 },
        );
      }
      await openNewFiscalYear(session.id, newYear);
      const data = await getFiscalStatus(session.id);
      return NextResponse.json({
        success: true,
        message: `تم فتح السنة المالية ${newYear}م`,
        data,
      });
    }

    return NextResponse.json(
      { success: false, message: 'إجراء غير معروف' },
      { status: 400 },
    );
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل العملية';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
