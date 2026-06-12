import { readFile } from "fs/promises";
import path from "path";
import type { jsPDF } from "jspdf";

export const PDF_BRAND_RGB: [number, number, number] = [27, 42, 74];
export const PDF_BRAND_LIGHT_RGB: [number, number, number] = [44, 74, 124];
export const PDF_BRAND_PALE_RGB: [number, number, number] = [238, 242, 250];
export const PDF_MIST_RGB: [number, number, number] = [122, 139, 173];
export const PDF_SLATE_RGB: [number, number, number] = [58, 78, 114];
export const PDF_INK_RGB: [number, number, number] = [15, 25, 35];

let cachedFontBase64: string | null = null;

const FONT_URLS = [
  path.join(process.cwd(), "public", "fonts", "Amiri-Regular.ttf"),
  "https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf",
];

export async function getArabicFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;

  for (const source of FONT_URLS) {
    try {
      if (source.startsWith("http")) {
        const res = await fetch(source);
        if (!res.ok) continue;
        cachedFontBase64 = Buffer.from(await res.arrayBuffer()).toString("base64");
        return cachedFontBase64;
      }

      const buffer = await readFile(source);
      cachedFontBase64 = buffer.toString("base64");
      return cachedFontBase64;
    } catch {
      // try next source
    }
  }

  throw new Error("تعذر تحميل خط العربية للتقرير");
}

export function registerArabicFont(doc: jsPDF, fontBase64: string) {
  doc.addFileToVFS("Amiri-Regular.ttf", fontBase64);
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  doc.setFont("Amiri");
}

export async function loadAvatarImage(
  avatarUrl: string | null,
): Promise<{ data: string; format: "JPEG" | "PNG" | "WEBP" } | null> {
  if (!avatarUrl) return null;

  const cleanPath = avatarUrl.split("?")[0];
  const filePath = path.join(process.cwd(), "public", cleanPath.replace(/^\//, ""));

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const format =
      ext === ".png" ? "PNG" : ext === ".webp" ? "WEBP" : ("JPEG" as const);
    return { data: buffer.toString("base64"), format };
  } catch {
    return null;
  }
}

export function formatPdfDate(date: Date) {
  return {
    dateLine: date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    dayLine: date.toLocaleDateString("ar-SA", { weekday: "long" }),
  };
}

export interface PdfPageHeaderUser {
  displayName: string;
  username: string;
  avatar_url: string | null;
}

export function drawPdfPageHeader(
  doc: jsPDF,
  user: PdfPageHeaderUser,
  avatar: { data: string; format: "JPEG" | "PNG" | "WEBP" } | null,
  title: string,
  now: Date,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const topY = 20;
  const { dateLine, dayLine } = formatPdfDate(now);

  doc.setFontSize(12);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(user.displayName || user.username, margin, topY, { align: "left" });

  doc.setFontSize(11);
  doc.setTextColor(...PDF_MIST_RGB);
  doc.text(dateLine, margin, topY + 8, { align: "left" });
  doc.setFontSize(10);
  doc.text(dayLine, margin, topY + 16, { align: "left" });

  doc.setFontSize(20);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(title, pageWidth / 2, topY + 4, { align: "center" });

  const imageSize = 24;
  const imageX = pageWidth - margin - imageSize;
  const imageY = topY - 6;

  if (avatar) {
    doc.addImage(avatar.data, avatar.format, imageX, imageY, imageSize, imageSize);
  } else {
    doc.setFillColor(...PDF_BRAND_PALE_RGB);
    doc.roundedRect(imageX, imageY, imageSize, imageSize, 3, 3, "F");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_BRAND_RGB);
    const initial = (user.displayName || user.username).charAt(0);
    doc.text(initial, imageX + imageSize / 2, imageY + imageSize / 2 + 2, {
      align: "center",
    });
  }

  doc.setFontSize(10);
  doc.setTextColor(...PDF_MIST_RGB);
  doc.text(user.username, pageWidth - margin, imageY + imageSize + 6, {
    align: "right",
  });

  doc.setDrawColor(196, 216, 210);
  doc.line(margin, 56, pageWidth - margin, 56);
}

/** Y position for content placed below the centered page title (default 3cm). */
export function getPdfContentStartY(belowTitleMm = 30): number {
  const topY = 20;
  const titleY = topY + 4;
  return titleY + belowTitleMm;
}
