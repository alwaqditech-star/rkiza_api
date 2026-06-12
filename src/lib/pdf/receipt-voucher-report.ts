import { jsPDF } from "jspdf";
import { arabicAmount, fmtAmt, fmtDate } from "@/lib/format";
import {
  drawPdfPageHeader,
  getArabicFontBase64,
  getPdfContentStartY,
  loadAvatarImage,
  PDF_BRAND_PALE_RGB,
  PDF_BRAND_RGB,
  PDF_INK_RGB,
  PDF_MIST_RGB,
  PDF_SLATE_RGB,
  registerArabicFont,
} from "@/lib/pdf/arabic-pdf-helpers";
import type { VoucherType } from "@/lib/types";

export interface VoucherPdfInput {
  voucher_type: VoucherType;
  association_name: string;
  username: string;
  avatar_url: string | null;
  voucher_number: string;
  voucher_date: string;
  beneficiary_name: string | null;
  total_amount: number;
  purpose: string;
}

function voucherLabels(voucherType: VoucherType) {
  if (voucherType === "receipt") {
    return {
      pageTitle: "سند القبض",
      voucherTitle: "سند قبض",
      partyLabel: "من",
      filenamePrefix: "sanad-qabd",
    };
  }

  return {
    pageTitle: "سند الصرف",
    voucherTitle: "سند صرف",
    partyLabel: "إلى",
    filenamePrefix: "sanad-sarf",
  };
}

function drawVoucherPreview(
  doc: jsPDF,
  voucher: VoucherPdfInput,
  startY: number,
) {
  const labels = voucherLabels(voucher.voucher_type);
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxW = 150;
  const boxX = (pageWidth - boxW) / 2;
  const boxY = startY;
  const boxH = 108;
  const pad = 10;
  const centerX = pageWidth / 2;

  doc.setDrawColor(...PDF_BRAND_RGB);
  doc.setLineWidth(0.7);
  doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, "S");

  let y = boxY + pad + 4;

  doc.setFontSize(8);
  doc.setTextColor(...PDF_MIST_RGB);
  doc.text("RIKAZ ACCOUNTING", centerX, y, { align: "center" });

  y += 8;
  doc.setFontSize(18);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(labels.voucherTitle, centerX, y, { align: "center" });

  y += 7;
  const badgeW = doc.getTextWidth(voucher.voucher_number) + 12;
  const badgeX = centerX - badgeW / 2;
  doc.setFillColor(...PDF_BRAND_PALE_RGB);
  doc.roundedRect(badgeX, y - 4, badgeW, 7, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(voucher.voucher_number, centerX, y + 1, { align: "center" });

  y += 10;
  doc.setDrawColor(196, 216, 210);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(boxX + pad, y, boxX + boxW - pad, y);
  doc.setLineDashPattern([], 0);

  y += 10;
  const colW = (boxW - pad * 2) / 2;

  doc.setFontSize(8);
  doc.setTextColor(...PDF_MIST_RGB);
  doc.text("التاريخ", boxX + boxW - pad, y, { align: "right" });
  doc.text(labels.partyLabel, boxX + boxW - pad - colW, y, { align: "right" });

  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(...PDF_INK_RGB);
  doc.text(fmtDate(voucher.voucher_date), boxX + boxW - pad, y, { align: "right" });
  doc.text(voucher.beneficiary_name || "—", boxX + boxW - pad - colW, y, {
    align: "right",
  });

  y += 12;
  const amountBoxH = 28;
  doc.setFillColor(...PDF_BRAND_PALE_RGB);
  doc.setDrawColor(...PDF_BRAND_RGB);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX + pad, y, boxW - pad * 2, amountBoxH, 3, 3, "FD");

  doc.setFontSize(22);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(fmtAmt(voucher.total_amount), centerX, y + 11, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text("ريال سعودي", centerX, y + 17, { align: "center" });

  const words = arabicAmount(voucher.total_amount);
  doc.setFontSize(9);
  doc.setTextColor(...PDF_SLATE_RGB);
  const wordsLines = doc.splitTextToSize(words, boxW - pad * 2 - 4);
  doc.text(wordsLines, centerX, y + 22, { align: "center" });

  y += amountBoxH + 10;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MIST_RGB);
  doc.text("البيان", boxX + boxW - pad, y, { align: "right" });

  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(...PDF_INK_RGB);
  const purposeLines = doc.splitTextToSize(voucher.purpose || "—", boxW - pad * 2);
  doc.text(purposeLines, boxX + boxW - pad, y, { align: "right" });
}

export async function buildVoucherPdf(voucher: VoucherPdfInput): Promise<Buffer> {
  const labels = voucherLabels(voucher.voucher_type);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontBase64 = await getArabicFontBase64();
  registerArabicFont(doc, fontBase64);

  const avatar = await loadAvatarImage(voucher.avatar_url);
  const now = new Date();

  drawPdfPageHeader(
    doc,
    {
      displayName: voucher.association_name,
      username: voucher.username,
      avatar_url: voucher.avatar_url,
    },
    avatar,
    labels.pageTitle,
    now,
  );

  const voucherY =
    voucher.voucher_type === "disbursement"
      ? getPdfContentStartY(30)
      : 52 +
        (doc.internal.pageSize.getHeight() - 52 - 108) / 2 -
        8;

  drawVoucherPreview(doc, voucher, voucherY);

  return Buffer.from(doc.output("arraybuffer"));
}

export function getVoucherPdfFilename(
  voucherType: VoucherType,
  voucherNumber: string,
): string {
  const labels = voucherLabels(voucherType);
  const safeNumber = voucherNumber.replace(/[^\w-]+/g, "_");
  return `${labels.filenamePrefix}-${safeNumber}.pdf`;
}

/** @deprecated Use buildVoucherPdf */
export const buildReceiptVoucherPdf = buildVoucherPdf;
