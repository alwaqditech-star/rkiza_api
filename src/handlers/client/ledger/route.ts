import { NextResponse } from 'next/server';
import { requireClientSession } from '@/lib/auth';
import { getAccountLedger } from '@/lib/journal-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account') ?? '';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    if (!account) {
      return NextResponse.json(
        { success: false, message: 'اختر الحساب أولاً' },
        { status: 400 },
      );
    }

    const data = await getAccountLedger(session.id, account, from, to);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    if (message.includes("doesn't exist") || message.includes('manual_journals')) {
      return NextResponse.json(
        {
          success: false,
          message: 'يرجى تشغيل patch-manual-journals.sql على قاعدة البيانات',
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}
