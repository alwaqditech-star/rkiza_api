import { requireClientSession } from '@/lib/auth';
import { ledgerFilename } from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportPdfResponse,
  getAssociationExportInfo,
} from '@/lib/export-association';
import { getAccountLedger } from '@/lib/journal-service';
import { buildLedgerPdf } from '@/lib/pdf/accounting-export-pdf';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account') ?? '';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    if (!account) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }

    const assoc = await getAssociationExportInfo(session.id);
    if (!assoc) {
      return exportErrorResponse(new Error('الجمعية غير موجودة'));
    }

    const data = await getAccountLedger(session.id, account, from, to);
    if (!data) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }
    const buffer = await buildLedgerPdf(
      {
        displayName: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      'دفتر الأستاذ العام',
      data,
      from,
      to,
    );

    return exportPdfResponse(
      buffer,
      ledgerFilename(account, from, to, 'pdf'),
    );
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير PDF');
  }
}
