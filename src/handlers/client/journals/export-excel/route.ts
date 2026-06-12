import { requireClientSession } from '@/lib/auth';
import {
  buildJournalBookExcel,
  journalBookFilename,
} from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { listUnifiedJournals } from '@/lib/journal-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? '';

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return exportErrorResponse(new Error('الشهر غير صالح'));
    }

    const items = await listUnifiedJournals(session.id, month);
    const buffer = await buildJournalBookExcel(month, items);
    return exportExcelResponse(buffer, journalBookFilename(month, 'xlsx'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
