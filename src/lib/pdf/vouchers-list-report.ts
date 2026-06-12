import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtAmt, fmtDate } from "@/lib/format";
import {
  getVoucherListExportLabels,
  type VoucherListExportRow,
} from "@/lib/vouchers-list-export";
import {
  drawPdfPageHeader,
  getArabicFontBase64,
  getPdfContentStartY,
  loadAvatarImage,
  PDF_BRAND_PALE_RGB,
  PDF_BRAND_RGB,
  PDF_MIST_RGB,
  registerArabicFont,
} from "@/lib/pdf/arabic-pdf-helpers";
import type { VoucherType } from "@/lib/types";

export interface VouchersListReportUser {
  association_name: string;
  username: string;
  avatar_url: string | null;
}

export async function buildVouchersListReportPdf(
  voucherType: VoucherType,
  user: VouchersListReportUser,
  rows: VoucherListExportRow[],
): Promise<Buffer> {
  const labels = getVoucherListExportLabels(voucherType);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontBase64 = await getArabicFontBase64();
  registerArabicFont(doc, fontBase64);

  const avatar = await loadAvatarImage(user.avatar_url);
  const now = new Date();

  drawPdfPageHeader(
    doc,
    {
      displayName: user.association_name,
      username: user.username,
      avatar_url: user.avatar_url,
    },
    avatar,
    labels.pageTitle,
    now,
  );

  const tableBody = rows.map((row, index) => [
    String(index + 1),
    row.voucher_number,
    fmtDate(row.voucher_date),
    row.beneficiary_name ?? "—",
    fmtAmt(row.total_amount),
    row.method,
    row.purpose,
    row.account_name,
  ]);

  const totalAmount = rows.reduce((sum, row) => sum + row.total_amount, 0);
  if (rows.length > 0) {
    tableBody.push(["", "", "", "الإجمالي", fmtAmt(totalAmount), "", "", ""]);
  }

  autoTable(doc, {
    startY: getPdfContentStartY(30),
    head: [
      [
        "#",
        "رقم السند",
        "التاريخ",
        labels.partyColumn,
        "المبلغ (ر.س)",
        "طريقة الدفع",
        "الغرض",
        "الحساب",
      ],
    ],
    body: tableBody,
    styles: {
      font: "Amiri",
      fontSize: 9,
      halign: "right",
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [...PDF_BRAND_RGB],
      textColor: [255, 255, 255],
      fontStyle: "normal",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [...PDF_BRAND_PALE_RGB] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_MIST_RGB);
    doc.text(
      `صفحة ${i} من ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** @deprecated Use buildVouchersListReportPdf */
export const buildDisbursementVouchersReportPdf = (
  user: VouchersListReportUser,
  rows: VoucherListExportRow[],
) => buildVouchersListReportPdf("disbursement", user, rows);
