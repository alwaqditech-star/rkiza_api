import ExcelJS from "exceljs";
import { fmtAmt, fmtDate } from "@/lib/format";
import type { VoucherType } from "@/lib/types";
import type { VoucherListItem } from "@/lib/vouchers";

export interface VoucherListExportRow {
  voucher_number: string;
  voucher_date: string;
  beneficiary_name: string | null;
  total_amount: number;
  method: string;
  purpose: string;
  account_name: string;
}

function exportLabels(voucherType: VoucherType) {
  if (voucherType === "receipt") {
    return {
      sheetName: "سندات القبض",
      pageTitle: "سند القبض",
      partyColumn: "المستلم من",
      filePrefix: "sanadat-qabd",
    };
  }

  return {
    sheetName: "سندات الصرف",
    pageTitle: "سند الصرف",
    partyColumn: "المستفيد",
    filePrefix: "sanadat-sarf",
  };
}

export function getVoucherListExportFilename(
  voucherType: VoucherType,
  extension: "xlsx" | "pdf",
): string {
  const { filePrefix } = exportLabels(voucherType);
  return `${filePrefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function mapVoucherListExportRows(
  items: VoucherListItem[],
): VoucherListExportRow[] {
  return items.map((item) => ({
    voucher_number: item.voucher_number,
    voucher_date: item.voucher_date,
    beneficiary_name: item.beneficiary_name,
    total_amount: item.total_amount,
    method: item.meta.method,
    purpose: item.meta.purpose,
    account_name: item.account_name ?? item.meta.account_code,
  }));
}

export async function buildVouchersListExcel(
  voucherType: VoucherType,
  rows: VoucherListExportRow[],
): Promise<Buffer> {
  const labels = exportLabels(voucherType);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rikaz";
  const sheet = workbook.addWorksheet(labels.sheetName, {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: "#", key: "index", width: 6 },
    { header: "رقم السند", key: "voucher_number", width: 14 },
    { header: "التاريخ", key: "voucher_date", width: 14 },
    { header: labels.partyColumn, key: "beneficiary_name", width: 24 },
    { header: "المبلغ (ر.س)", key: "total_amount", width: 14 },
    { header: "طريقة الدفع", key: "method", width: 14 },
    { header: "الغرض", key: "purpose", width: 28 },
    { header: "الحساب", key: "account_name", width: 28 },
  ];

  sheet.getRow(1).font = { bold: true };

  rows.forEach((row, index) => {
    sheet.addRow({
      index: index + 1,
      voucher_number: row.voucher_number,
      voucher_date: fmtDate(row.voucher_date),
      beneficiary_name: row.beneficiary_name ?? "—",
      total_amount: Number(row.total_amount),
      method: row.method,
      purpose: row.purpose,
      account_name: row.account_name,
    });
  });

  const totalRow = sheet.addRow({
    index: "",
    voucher_number: "",
    voucher_date: "",
    beneficiary_name: "الإجمالي",
    total_amount: rows.reduce((sum, row) => sum + row.total_amount, 0),
    method: "",
    purpose: "",
    account_name: "",
  });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { exportLabels as getVoucherListExportLabels };
