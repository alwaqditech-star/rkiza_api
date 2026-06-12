import { NextResponse } from 'next/server';
import { requireClientSession } from '@/lib/auth';
import { getDashboardStats } from '@/lib/vouchers';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await getDashboardStats(session.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 401 },
    );
  }
}
