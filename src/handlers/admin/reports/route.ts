import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import ExcelJS from "exceljs";
import { query } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";
import { enrichAssociation, type AssociationRow } from "@/lib/associations";

interface VoucherSummaryRow extends RowDataPacket {
  association_id: number;
  voucher_type: string;
  count: number;
  total: number;
}

interface CountRow extends RowDataPacket {
  association_id: number;
  count: number;
}

interface SafetyRow extends RowDataPacket {
  association_id: number;
  fiscal_year: number;
  total_expenses: number;
  admin_expenses: number;
  program_expenses: number;
  total_donations: number;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function calcSafetyScore(data: SafetyRow): number {
  const adminRatio = safeDivide(data.admin_expenses, data.total_expenses);
  const programRatio = safeDivide(data.program_expenses, data.total_expenses);
  let score = 0;
  if (adminRatio <= 0.15) score += 20;
  if (programRatio >= 0.8) score += 45;
  if (data.total_donations > 0) score += 10;
  return Math.min(100, score);
}

async function buildReports() {
  const associations = await query<AssociationRow[]>(
    `SELECT id, association_name, username, is_first_login,
            subscription_start, subscription_end, status, created_at
     FROM associations ORDER BY association_name`
  );

  const voucherRows = await query<VoucherSummaryRow[]>(
    `SELECT association_id, voucher_type, COUNT(*) as count,
            COALESCE(SUM(total_amount), 0) as total
     FROM financial_vouchers
     GROUP BY association_id, voucher_type`
  );

  const accountRows = await query<CountRow[]>(
    `SELECT association_id, COUNT(*) as count
     FROM chart_of_accounts GROUP BY association_id`
  );

  const safetyRows = await query<SafetyRow[]>(
    `SELECT s.association_id, s.fiscal_year, s.total_expenses, s.admin_expenses,
            s.program_expenses, s.total_donations
     FROM safety_financial_inputs s
     INNER JOIN (
       SELECT association_id, MAX(fiscal_year) as max_year
       FROM safety_financial_inputs GROUP BY association_id
     ) latest ON s.association_id = latest.association_id
             AND s.fiscal_year = latest.max_year`
  );

  const voucherMap = new Map<
    number,
    { receipts: number; receiptTotal: number; disbursements: number; disbursementTotal: number }
  >();
  for (const row of voucherRows) {
    if (!voucherMap.has(row.association_id)) {
      voucherMap.set(row.association_id, {
        receipts: 0,
        receiptTotal: 0,
        disbursements: 0,
        disbursementTotal: 0,
      });
    }
    const entry = voucherMap.get(row.association_id)!;
    if (row.voucher_type === "receipt") {
      entry.receipts = row.count;
      entry.receiptTotal = Number(row.total);
    } else {
      entry.disbursements = row.count;
      entry.disbursementTotal = Number(row.total);
    }
  }

  const accountMap = new Map(
    accountRows.map((r) => [r.association_id, r.count])
  );
  const safetyMap = new Map(safetyRows.map((r) => [r.association_id, r]));

  const reports = associations.map((assoc) => {
    const enriched = enrichAssociation(assoc);
    const vouchers = voucherMap.get(assoc.id) || {
      receipts: 0,
      receiptTotal: 0,
      disbursements: 0,
      disbursementTotal: 0,
    };
    const safety = safetyMap.get(assoc.id);
    const safetyScore = safety ? calcSafetyScore(safety) : null;

    return {
      association_id: assoc.id,
      association_name: assoc.association_name,
      username: assoc.username,
      status: assoc.status,
      subscription_start: assoc.subscription_start,
      subscription_end: assoc.subscription_end,
      days_remaining: enriched.days_remaining,
      subscription_alert: enriched.subscription_alert,
      accounts_count: accountMap.get(assoc.id) || 0,
      vouchers,
      safety: safety
        ? {
            fiscal_year: safety.fiscal_year,
            total_expenses: Number(safety.total_expenses),
            admin_expenses: Number(safety.admin_expenses),
            program_expenses: Number(safety.program_expenses),
            total_donations: Number(safety.total_donations),
            score: safetyScore,
          }
        : null,
    };
  });

  const totals = {
    associations: reports.length,
    active: reports.filter((r) => r.status === "active").length,
    expiring_soon: reports.filter((r) => r.subscription_alert).length,
    total_receipts: reports.reduce((s, r) => s + r.vouchers.receiptTotal, 0),
    total_disbursements: reports.reduce(
      (s, r) => s + r.vouchers.disbursementTotal,
      0
    ),
  };

  return { reports, totals, generated_at: new Date().toISOString() };
}

async function buildExcel(data: Awaited<ReturnType<typeof buildReports>>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rikaz";
  const sheet = workbook.addWorksheet("تقرير الجمعيات", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: "الجمعية", key: "name", width: 28 },
    { header: "اسم المستخدم", key: "username", width: 18 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "نهاية الاشتراك", key: "end", width: 14 },
    { header: "الأيام المتبقية", key: "days", width: 14 },
    { header: "سندات قبض", key: "receipts", width: 12 },
    { header: "إجمالي القبض", key: "receiptTotal", width: 14 },
    { header: "سندات صرف", key: "disbursements", width: 12 },
    { header: "إجمالي الصرف", key: "disbursementTotal", width: 14 },
    { header: "عدد الحسابات", key: "accounts", width: 14 },
    { header: "درجة السلامة", key: "safety", width: 12 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const report of data.reports) {
    sheet.addRow({
      name: report.association_name,
      username: report.username,
      status: report.status === "active" ? "نشط" : "منتهي",
      end: String(report.subscription_end).slice(0, 10),
      days: report.days_remaining,
      receipts: report.vouchers.receipts,
      receiptTotal: report.vouchers.receiptTotal,
      disbursements: report.vouchers.disbursements,
      disbursementTotal: report.vouchers.disbursementTotal,
      accounts: report.accounts_count,
      safety: report.safety?.score ?? "—",
    });
  }

  return workbook.xlsx.writeBuffer();
}

export async function GET(request: Request) {
  try {
    let admin;
    try {
      admin = await requireAdminSession();
    } catch {
      admin = null;
    }
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const data = await buildReports();

    if (format === "excel") {
      const buffer = await buildExcel(data);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="rikaz-admin-reports.xlsx"',
        },
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في جلب التقارير", error: message },
      { status: 500 }
    );
  }
}
