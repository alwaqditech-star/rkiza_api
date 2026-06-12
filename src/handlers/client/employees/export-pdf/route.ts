import { requireClientSession } from '@/lib/auth';
import { employeesFilename } from '@/lib/hr-export';
import {
  exportErrorResponse,
  exportPdfResponse,
  getAssociationExportInfo,
} from '@/lib/export-association';
import { listEmployees } from '@/lib/employee-service';
import { buildEmployeesPdf } from '@/lib/pdf/hr-export-pdf';

export async function GET() {
  try {
    const session = await requireClientSession();
    const assoc = await getAssociationExportInfo(session.id);
    if (!assoc) {
      return exportErrorResponse(new Error('الجمعية غير موجودة'));
    }

    const employees = await listEmployees(session.id);
    if (employees.length === 0) {
      return exportErrorResponse(new Error('لا يوجد موظفون للتصدير'));
    }

    const buffer = await buildEmployeesPdf(
      {
        displayName: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      employees,
    );

    return exportPdfResponse(buffer, employeesFilename('pdf'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير PDF');
  }
}
