import { requireClientSession } from '@/lib/auth';
import { buildEmployeesExcel, employeesFilename } from '@/lib/hr-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { listEmployees } from '@/lib/employee-service';

export async function GET() {
  try {
    const session = await requireClientSession();
    const employees = await listEmployees(session.id);

    if (employees.length === 0) {
      return exportErrorResponse(new Error('لا يوجد موظفون للتصدير'));
    }

    const buffer = await buildEmployeesExcel(employees);
    return exportExcelResponse(buffer, employeesFilename('xlsx'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
