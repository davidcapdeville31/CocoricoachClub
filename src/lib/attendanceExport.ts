import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { preparePdfWithSettings } from "@/lib/pdfExport";
import {
  getExcelBranding,
  addBrandedHeader,
  styleDataHeaderRow,
  addFooter,
  downloadWorkbook,
} from "@/lib/excelExport";

export type AttendanceExportRow = {
  name: string;
  status: "present" | "absent" | "no_response";
  comment?: string | null;
  respondedAt?: string | null;
};

export interface AttendanceExportContext {
  categoryId: string;
  sessionLabel: string;
  sessionDate: string; // dd/MM/yyyy
  rows: AttendanceExportRow[];
  labels: {
    title: string;
    athlete: string;
    status: string;
    reason: string;
    respondedAt: string;
    present: string;
    absent: string;
    noResponse: string;
    session: string;
    date: string;
  };
}

const STATUS_RGB: Record<AttendanceExportRow["status"], [number, number, number]> = {
  present: [16, 129, 85],
  absent: [190, 30, 60],
  no_response: [120, 128, 138],
};

const STATUS_FILL: Record<AttendanceExportRow["status"], [number, number, number]> = {
  present: [226, 246, 236],
  absent: [252, 231, 234],
  no_response: [240, 242, 245],
};

const STATUS_ARGB: Record<AttendanceExportRow["status"], string> = {
  present: "FFE2F6EC",
  absent: "FFFCE7EA",
  no_response: "FFF0F2F5",
};

const STATUS_TEXT_ARGB: Record<AttendanceExportRow["status"], string> = {
  present: "FF108155",
  absent: "FFBE1E3C",
  no_response: "FF78808A",
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export async function exportAttendancePdf(ctx: AttendanceExportContext) {
  const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(ctx.categoryId);
  const headerRgb = hexToRgb(settings?.header_color || "#224378");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Banner
  doc.setFillColor(...headerRgb);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(ctx.labels.title, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [settings?.club_name_override || clubName, categoryName, seasonName].filter(Boolean).join("  •  "),
    margin,
    19,
  );

  let y = 36;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(`${ctx.labels.session} : ${ctx.sessionLabel}`, margin, y);
  y += 5;
  doc.text(`${ctx.labels.date} : ${ctx.sessionDate}`, margin, y);
  y += 9;

  const counts = {
    present: ctx.rows.filter((r) => r.status === "present").length,
    absent: ctx.rows.filter((r) => r.status === "absent").length,
    no_response: ctx.rows.filter((r) => r.status === "no_response").length,
  };
  const chips: [string, AttendanceExportRow["status"]][] = [
    [`${ctx.labels.present}: ${counts.present}`, "present"],
    [`${ctx.labels.absent}: ${counts.absent}`, "absent"],
    [`${ctx.labels.noResponse}: ${counts.no_response}`, "no_response"],
  ];
  let cx = margin;
  chips.forEach(([label, status]) => {
    const w = doc.getTextWidth(label) + 8;
    doc.setFillColor(...STATUS_FILL[status]);
    doc.roundedRect(cx, y - 5, w, 8, 2, 2, "F");
    doc.setTextColor(...STATUS_RGB[status]);
    doc.setFontSize(9);
    doc.text(label, cx + 4, y);
    cx += w + 4;
  });
  y += 12;

  // Table
  const cols = [
    { key: "name", label: ctx.labels.athlete, w: 58 },
    { key: "status", label: ctx.labels.status, w: 30 },
    { key: "comment", label: ctx.labels.reason, w: 60 },
    { key: "respondedAt", label: ctx.labels.respondedAt, w: 38 },
  ];

  const drawHead = () => {
    doc.setFillColor(...headerRgb);
    doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = margin + 2;
    cols.forEach((c) => {
      doc.text(c.label, x, y);
      x += c.w;
    });
    y += 9;
    doc.setFont("helvetica", "normal");
  };
  drawHead();

  const statusLabel = (s: AttendanceExportRow["status"]) =>
    s === "present" ? ctx.labels.present : s === "absent" ? ctx.labels.absent : ctx.labels.noResponse;

  ctx.rows.forEach((r) => {
    const commentLines = doc.splitTextToSize(r.comment || "", cols[2].w - 4) as string[];
    const rowH = Math.max(7, commentLines.length * 4.5 + 2.5);

    if (y + rowH > pageH - 16) {
      doc.addPage();
      y = 20;
      drawHead();
    }

    doc.setFillColor(...STATUS_FILL[r.status]);
    doc.rect(margin, y - 5, pageW - margin * 2, rowH, "F");
    doc.setDrawColor(225, 228, 232);
    doc.line(margin, y - 5 + rowH, pageW - margin, y - 5 + rowH);

    let x = margin + 2;
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(r.name, x, y);
    x += cols[0].w;
    doc.setTextColor(...STATUS_RGB[r.status]);
    doc.setFont("helvetica", "bold");
    doc.text(statusLabel(r.status), x, y);
    doc.setFont("helvetica", "normal");
    x += cols[1].w;
    doc.setTextColor(70, 70, 70);
    if (commentLines.length) doc.text(commentLines, x, y);
    x += cols[2].w;
    doc.text(r.respondedAt || "-", x, y);

    y += rowH;
  });

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 8, { align: "center" });
  }

  doc.save(`presence_${ctx.sessionDate.replace(/\//g, "-")}.pdf`);
}

export async function exportAttendanceExcel(ctx: AttendanceExportContext) {
  const branding = await getExcelBranding(ctx.categoryId);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(ctx.labels.title.slice(0, 28) || "Presence");

  sheet.columns = [
    { width: 30 },
    { width: 16 },
    { width: 45 },
    { width: 20 },
  ];

  const startRow = addBrandedHeader(sheet, ctx.labels.title, branding, [
    [ctx.labels.session, ctx.sessionLabel],
    [ctx.labels.date, ctx.sessionDate],
    [ctx.labels.present, String(ctx.rows.filter((r) => r.status === "present").length)],
    [ctx.labels.absent, String(ctx.rows.filter((r) => r.status === "absent").length)],
    [ctx.labels.noResponse, String(ctx.rows.filter((r) => r.status === "no_response").length)],
  ]);

  const headerRow = sheet.getRow(startRow);
  headerRow.values = [ctx.labels.athlete, ctx.labels.status, ctx.labels.reason, ctx.labels.respondedAt];
  styleDataHeaderRow(sheet, startRow, 4, branding.headerColor);

  let r = startRow + 1;
  ctx.rows.forEach((row) => {
    const excelRow = sheet.getRow(r);
    excelRow.values = [
      row.name,
      row.status === "present"
        ? ctx.labels.present
        : row.status === "absent"
          ? ctx.labels.absent
          : ctx.labels.noResponse,
      row.comment || "",
      row.respondedAt || "",
    ];
    for (let c = 1; c <= 4; c++) {
      const cell = excelRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_ARGB[row.status] } };
      cell.alignment = { vertical: "middle", wrapText: c === 3 };
      if (c === 2) cell.font = { bold: true, color: { argb: STATUS_TEXT_ARGB[row.status] } };
    }
    r++;
  });

  addFooter(sheet, r, 4, branding.footerText);
  await downloadWorkbook(
    workbook,
    `presence_${ctx.sessionDate.replace(/\//g, "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`,
  );
}

/* ------------------------------------------------------------------ */
/* Day export — all sessions of one day condensed in a single table     */
/* ------------------------------------------------------------------ */

export interface AttendanceDaySession {
  id: string;
  label: string;
}

export interface AttendanceDayRow {
  name: string;
  cells: Record<string, { status: AttendanceExportRow["status"]; comment?: string | null }>;
}

export interface AttendanceDayExportContext {
  categoryId: string;
  dayLabel: string; // dd/MM/yyyy
  sessions: AttendanceDaySession[];
  rows: AttendanceDayRow[];
  labels: AttendanceExportContext["labels"];
}

const shortStatus = (
  s: AttendanceExportRow["status"],
  labels: AttendanceExportContext["labels"],
) => (s === "present" ? labels.present : s === "absent" ? labels.absent : labels.noResponse);

export async function exportAttendanceDayPdf(ctx: AttendanceDayExportContext) {
  const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(ctx.categoryId);
  const headerRgb = hexToRgb(settings?.header_color || "#224378");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  doc.setFillColor(...headerRgb);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${ctx.labels.title} — ${ctx.dayLabel}`, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [settings?.club_name_override || clubName, categoryName, seasonName].filter(Boolean).join("  •  "),
    margin,
    18,
  );

  let y = 32;
  const nameW = 52;
  const colW = Math.max(
    26,
    Math.min(52, (pageW - margin * 2 - nameW) / Math.max(1, ctx.sessions.length)),
  );

  const drawHead = () => {
    doc.setFillColor(...headerRgb);
    doc.rect(margin, y - 5, nameW + colW * ctx.sessions.length, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(ctx.labels.athlete, margin + 2, y + 2);
    let x = margin + nameW;
    ctx.sessions.forEach((s) => {
      const lines = doc.splitTextToSize(s.label, colW - 3) as string[];
      doc.text(lines.slice(0, 2), x + 2, y - 1);
      x += colW;
    });
    y += 13;
    doc.setFont("helvetica", "normal");
  };
  drawHead();

  ctx.rows.forEach((row) => {
    const rowH = 7;
    if (y + rowH > pageH - 12) {
      doc.addPage();
      y = 20;
      drawHead();
    }
    doc.setDrawColor(225, 228, 232);
    doc.line(margin, y + 2, margin + nameW + colW * ctx.sessions.length, y + 2);

    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(row.name, nameW - 3)[0], margin + 2, y);

    let x = margin + nameW;
    ctx.sessions.forEach((s) => {
      const cell = row.cells[s.id] || { status: "no_response" as const };
      doc.setFillColor(...STATUS_FILL[cell.status]);
      doc.rect(x, y - 4.5, colW - 1, rowH - 0.5, "F");
      doc.setTextColor(...STATUS_RGB[cell.status]);
      doc.setFont("helvetica", "bold");
      const label = shortStatus(cell.status, ctx.labels);
      doc.text(doc.splitTextToSize(label, colW - 4)[0], x + 2, y);
      doc.setFont("helvetica", "normal");
      if (cell.status === "absent" && cell.comment) {
        doc.setFontSize(6);
        doc.setTextColor(120, 60, 70);
        doc.text(doc.splitTextToSize(cell.comment, colW - 4)[0], x + 2, y + 2.6);
        doc.setFontSize(8);
      }
      x += colW;
    });
    y += rowH;
  });

  if (settings?.footer_text) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(settings.footer_text, pageW / 2, pageH - 6, { align: "center" });
  }

  doc.save(`presence_${ctx.dayLabel.replace(/\//g, "-")}.pdf`);
}

export async function exportAttendanceDayExcel(ctx: AttendanceDayExportContext) {
  const branding = await getExcelBranding(ctx.categoryId);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(ctx.dayLabel.replace(/\//g, "-"));

  sheet.columns = [{ width: 30 }, ...ctx.sessions.map(() => ({ width: 26 }))];

  const startRow = addBrandedHeader(sheet, `${ctx.labels.title} — ${ctx.dayLabel}`, branding, [
    [ctx.labels.date, ctx.dayLabel],
    [ctx.labels.session, ctx.sessions.map((s) => s.label).join(" | ")],
  ]);

  const headerRow = sheet.getRow(startRow);
  headerRow.values = [ctx.labels.athlete, ...ctx.sessions.map((s) => s.label)];
  styleDataHeaderRow(sheet, startRow, ctx.sessions.length + 1, branding.headerColor);

  let r = startRow + 1;
  ctx.rows.forEach((row) => {
    const excelRow = sheet.getRow(r);
    excelRow.values = [
      row.name,
      ...ctx.sessions.map((s) => {
        const cell = row.cells[s.id] || { status: "no_response" as const };
        const label = shortStatus(cell.status, ctx.labels);
        return cell.status === "absent" && cell.comment ? `${label} — ${cell.comment}` : label;
      }),
    ];
    ctx.sessions.forEach((s, i) => {
      const cell = excelRow.getCell(i + 2);
      const status = (row.cells[s.id]?.status || "no_response") as AttendanceExportRow["status"];
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_ARGB[status] } };
      cell.font = { bold: true, color: { argb: STATUS_TEXT_ARGB[status] } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    r++;
  });

  addFooter(sheet, r, ctx.sessions.length + 1, branding.footerText);
  await downloadWorkbook(
    workbook,
    `presence_${ctx.dayLabel.replace(/\//g, "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`,
  );
}
