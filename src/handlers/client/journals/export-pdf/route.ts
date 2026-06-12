import { requireClientSession } from '@/lib/auth';
import { journalBookFilename } from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportPdfResponse,
  getAssociationExportInfo,
} from '@/lib/export-association';
import { listUnifiedJournals } from '@/lib/journal-service';
import { buildJournalBookPdf } from '@/lib/pdf/accounting-export-pdf';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? '';

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return exportErrorResponse(new Error('الشهر غير صالح'));
    }

    const assoc = await getAssociationExportInfo(session.id);
    if (!assoc) {
      return exportErrorResponse(new Error('الجمعية غير موجودة'));
    }

    const items = await listUnifiedJournals(session.id, month);
    const buffer = await buildJournalBookPdf(
      {
        displayName: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      month,
      items,
    );

    return exportPdfResponse(buffer, journalBookFilename(month, 'pdf'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير PDF');
  }
}
