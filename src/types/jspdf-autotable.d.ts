declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface CellDef {
    content?: string | number;
    colSpan?: number;
    rowSpan?: number;
    styles?: Record<string, unknown>;
  }

  export type RowInput = (string | number | CellDef)[];

  export interface UserOptions {
    startY?: number;
    head?: RowInput[];
    body?: RowInput[];
    foot?: RowInput[];
    theme?: "striped" | "grid" | "plain";
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    didParseCell?: (data: {
      section: "head" | "body" | "foot";
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown> };
    }) => void;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
