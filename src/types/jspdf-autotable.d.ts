declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface UserOptions {
    startY?: number;
    head?: (string | number)[][];
    body?: (string | number)[][];
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
