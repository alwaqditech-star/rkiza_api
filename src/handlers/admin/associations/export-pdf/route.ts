import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { requireAdminSession } from "@/lib/auth";
import {
  enrichAssociation,
  type AssociationRow,
} from "@/lib/associations";
import { query } from "@/lib/db";
import { buildSubscribersReportPdf } from "@/lib/pdf/subscribers-report";

interface AdminRow extends RowDataPacket {
  username: string;
  name: string;
  avatar_url: string | null;
}

export async function GET() {
  try {
    const session = await requireAdminSession();

    const adminRows = await query<AdminRow[]>(
      "SELECT username, name, avatar_url FROM admins WHERE id = ?",
      [session.id],
    );
    if (adminRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "المدير غير موجود" },
        { status: 404 },
      );
    }

    const associations = await query<AssociationRow[]>(
      `SELECT id, association_name, username, is_first_login,
              subscription_start, subscription_end, status, created_at
       FROM associations
       ORDER BY created_at DESC`,
    );

    const enriched = associations.map(enrichAssociation);
    const reportRows = enriched.map((row) => ({
      association_name: row.association_name,
      username: row.username,
      subscription_end: String(row.subscription_end),
      days_remaining: row.days_remaining,
      status: row.status,
    }));
    const pdfBuffer = await buildSubscribersReportPdf(adminRows[0], reportRows);

    const filename = `kashf-almushtarikin-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    if (message.includes("Unauthorized") || message.includes("صلاحية")) {
      return NextResponse.json(
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: message.includes("خط")
          ? message
          : "فشل تصدير PDF",
        error: message,
      },
      { status: 500 },
    );
  }
}
