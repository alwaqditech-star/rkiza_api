import { NextResponse } from 'next/server';
import { requireClientSession, requireClientWrite } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import {
  createManualJournal,
  listUnifiedJournals,
  nextManualJournalNumber,
} from '@/lib/journal-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? undefined;

    const journals = await listUnifiedJournals(session.id, month || undefined);
    return NextResponse.json({ success: true, data: journals });
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

    const journalDate = String(body.journal_date ?? '').slice(0, 10);
    const description = String(body.description ?? '').trim();
    const reference = String(body.reference ?? '').trim();
    const entryType = String(body.entry_type ?? 'قيد عادي').trim();
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!journalDate || !description) {
      return NextResponse.json(
        { success: false, message: 'التاريخ والبيان مطلوبان' },
        { status: 400 },
      );
    }

    const id = await createManualJournal({
      associationId: session.id,
      journalDate,
      description,
      reference,
      entryType,
      lines: lines.map((line: Record<string, unknown>) => ({
        account_code: String(line.account_code ?? ''),
        debit_amount: Number(line.debit_amount ?? 0),
        credit_amount: Number(line.credit_amount ?? 0),
        line_description: String(line.line_description ?? description),
      })),
    });

    const journals = await listUnifiedJournals(session.id);
    const created = journals.find((journal) => journal.id === `m-${id}`);

    return NextResponse.json({
      success: true,
      message: 'تم حفظ القيد بنجاح',
      data: created ?? { id: `m-${id}` },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    return NextResponse.json(
      { success: false, message: message || 'فشل حفظ القيد' },
      { status: 400 },
    );
  }
}
