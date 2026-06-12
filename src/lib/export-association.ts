import type { RowDataPacket } from 'mysql2';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface AssociationExportInfo {
  association_name: string;
  username: string;
  avatar_url: string | null;
}

interface AssociationRow extends RowDataPacket {
  association_name: string;
  username: string;
  avatar_url: string | null;
}

export async function getAssociationExportInfo(
  associationId: number,
): Promise<AssociationExportInfo | null> {
  const rows = await query<AssociationRow[]>(
    'SELECT association_name, username, avatar_url FROM associations WHERE id = ?',
    [associationId],
  );
  return rows[0] ?? null;
}

export function exportExcelResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export function exportPdfResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export function exportErrorResponse(error: unknown, fallback = 'فشل التصدير') {
  const message = error instanceof Error ? error.message : 'خطأ غير معروف';
  if (message.includes('Unauthorized') || message.includes('صلاحية')) {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { success: false, message: message.includes('خط') ? message : fallback, error: message },
    { status: 500 },
  );
}
