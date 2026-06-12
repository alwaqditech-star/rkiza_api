import { NextResponse } from 'next/server';
import { requireClientSession } from '@/lib/auth';
import { listAccountsForReports } from '@/lib/journal-service';

export async function GET() {
  try {
    const session = await requireClientSession();
    const accounts = await listAccountsForReports(session.id);
    return NextResponse.json({ success: true, data: accounts });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}
