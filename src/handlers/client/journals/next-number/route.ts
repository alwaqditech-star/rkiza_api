import { NextResponse } from 'next/server';
import { requireClientSession } from '@/lib/auth';
import { nextManualJournalNumber } from '@/lib/journal-service';

export async function GET() {
  try {
    const session = await requireClientSession();
    const journal_number = await nextManualJournalNumber(session.id);
    return NextResponse.json({ success: true, data: { journal_number } });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}
