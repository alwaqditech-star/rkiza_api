import { NextResponse } from 'next/server';
import { requireClientSession, requireClientWrite } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { createEmployee, listEmployees } from '@/lib/employee-service';
import type { EmployeeStatus } from '@/lib/types';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await listEmployees(session.id);
    return NextResponse.json({ success: true, data });
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

    const name = String(body.name ?? '').trim();
    const jobTitle = String(body.job_title ?? '').trim();
    const basicSalary = Number(body.basic_salary ?? 0);

    if (!name || !jobTitle || !basicSalary) {
      return NextResponse.json(
        { success: false, message: 'الاسم والمسمى والراتب الأساسي مطلوبة' },
        { status: 400 },
      );
    }

    const status = String(body.status ?? 'active') as EmployeeStatus;
    const id = await createEmployee(session.id, {
      name,
      job_title: jobTitle,
      id_number: String(body.id_number ?? '').trim(),
      hire_date: String(body.hire_date ?? '').slice(0, 10) || undefined,
      basic_salary: basicSalary,
      housing_allowance: Number(body.housing_allowance ?? 0),
      transport_allowance: Number(body.transport_allowance ?? 0),
      commission: Number(body.commission ?? 0),
      gosi_percent: Number(body.gosi_percent ?? 9),
      status,
    });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ بيانات الموظف',
      data: { id },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل حفظ الموظف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
