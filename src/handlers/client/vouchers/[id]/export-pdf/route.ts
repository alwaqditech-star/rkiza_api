import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { requireClientSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  buildVoucherPdf,
  getVoucherPdfFilename,
} from "@/lib/pdf/receipt-voucher-report";
import { getVoucherById } from "@/lib/vouchers";

interface AssociationRow extends RowDataPacket {
  association_name: string;
  username: string;
  avatar_url: string | null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireClientSession();
    const { id } = await context.params;
    const voucherId = Number(id);

    if (!voucherId) {
      return NextResponse.json(
        { success: false, message: "معرف السند غير صالح" },
        { status: 400 },
      );
    }

    const voucher = await getVoucherById(session.id, voucherId);
    if (!voucher) {
      return NextResponse.json(
        { success: false, message: "السند غير موجود" },
        { status: 404 },
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

    const assoc = assocRows[0];
    const pdfBuffer = await buildVoucherPdf({
      voucher_type: voucher.voucher_type,
      association_name: assoc.association_name,
      username: assoc.username,
      avatar_url: assoc.avatar_url,
      voucher_number: voucher.voucher_number,
      voucher_date: voucher.voucher_date,
      beneficiary_name: voucher.beneficiary_name,
      total_amount: voucher.total_amount,
      purpose: voucher.meta.purpose,
    });

    const filename = getVoucherPdfFilename(
      voucher.voucher_type,
      voucher.voucher_number,
    );

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
