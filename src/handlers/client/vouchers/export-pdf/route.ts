import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { requireClientSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildVouchersListReportPdf } from "@/lib/pdf/vouchers-list-report";
import {
  getVoucherListExportFilename,
  mapVoucherListExportRows,
} from "@/lib/vouchers-list-export";
import { listVouchers } from "@/lib/vouchers";
import type { VoucherType } from "@/lib/types";

interface AssociationRow extends RowDataPacket {
  association_name: string;
  username: string;
  avatar_url: string | null;
}

function parseVoucherType(value: string | null): VoucherType | null {
  if (value === "receipt" || value === "disbursement") return value;
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const voucherType = parseVoucherType(searchParams.get("type"));

    if (!voucherType) {
      return NextResponse.json(
        { success: false, message: "نوع السند غير صالح" },
        { status: 400 },
      );
    }

    const assocRows = await query<AssociationRow[]>(
      "SELECT association_name, username, avatar_url FROM associations WHERE id = ?",
      [session.id],
    );
    if (assocRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "الجمعية غير موجودة" },
        { status: 404 },
      );
    }

    const items = await listVouchers(session.id, voucherType);
    const rows = mapVoucherListExportRows(items);
    const assoc = assocRows[0];
    const pdfBuffer = await buildVouchersListReportPdf(
      voucherType,
      {
        association_name: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      rows,
    );

    const filename = getVoucherListExportFilename(voucherType, "pdf");

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
        { success: false, message: "صلاحية الجمعية مطلوبة" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: message.includes("خط") ? message : "فشل تصدير PDF",
        error: message,
      },
      { status: 500 },
    );
  }
}
