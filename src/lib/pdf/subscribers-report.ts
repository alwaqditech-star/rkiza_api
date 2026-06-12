import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  drawPdfPageHeader,
  getArabicFontBase64,
  loadAvatarImage,
  PDF_BRAND_PALE_RGB,
  PDF_BRAND_RGB,
  PDF_MIST_RGB,
  registerArabicFont,
} from "@/lib/pdf/arabic-pdf-helpers";

export interface SubscribersReportRow {
  association_name: string;
  username: string;
  subscription_end: string;
  days_remaining: number;
  status: "active" | "expired";
}

export interface SubscribersReportAdmin {
  username: string;
  name: string;
  avatar_url: string | null;
}

function formatSubscriptionDate(value: string) {
  return new Date(value).toLocaleDateString("ar-SA");
}

export async function buildSubscribersReportPdf(
  admin: SubscribersReportAdmin,
  rows: SubscribersReportRow[],
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontBase64 = await getArabicFontBase64();
  registerArabicFont(doc, fontBase64);

  const avatar = await loadAvatarImage(admin.avatar_url);
  const now = new Date();
  drawPdfPageHeader(
    doc,
    {
      displayName: admin.name,
      username: admin.username,
      avatar_url: admin.avatar_url,
    },
    avatar,
    "كشف المشتركين",
    now,
  );

  const tableBody = rows.map((row, index) => [
    String(index + 1),
    row.association_name,
    row.username,
    formatSubscriptionDate(row.subscription_end),
    `${row.days_remaining} يوم`,
    row.status === "active" ? "نشط" : "منتهي",
  ]);

  autoTable(doc, {
    startY: 58,
    head: [["#", "الجمعية", "اسم المستخدم", "نهاية الاشتراك", "المتبقي", "الحالة"]],
    body: tableBody,
    styles: {
      font: "Amiri",
      fontSize: 10,
      halign: "right",
      cellPadding: 3,
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
