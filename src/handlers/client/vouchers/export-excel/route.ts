import { NextResponse } from "next/server";
import { requireClientSession } from "@/lib/auth";
import {
  buildVouchersListExcel,
  getVoucherListExportFilename,
  mapVoucherListExportRows,
} from "@/lib/vouchers-list-export";
import { listVouchers } from "@/lib/vouchers";
import type { VoucherType } from "@/lib/types";

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

    const items = await listVouchers(session.id, voucherType);
    const rows = mapVoucherListExportRows(items);
    const buffer = await buildVouchersListExcel(voucherType, rows);
    const filename = getVoucherListExportFilename(voucherType, "xlsx");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
      { success: false, message: "فشل تصدير Excel", error: message },
      { status: 500 },
    );
  }
}
