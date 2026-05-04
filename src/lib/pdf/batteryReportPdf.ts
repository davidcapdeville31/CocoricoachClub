import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getLevelForPercent, type BatteryLevel } from "@/lib/constants/testUnits";
import { getReportLogoDataUrl } from "@/lib/pdf/clubLogo";

interface TestRow {
  id: string;
  player_id: string;
  test_date: string;
  result_value: number | null;
  result_unit: string | null;
  notes: string | null;
  test_type: string | null;
  players?: { id: string; name: string; first_name?: string | null; avatar_url?: string | null } | null;
}

interface BatteryItemDef {
  test_name: string;
  max_points: number;
  test_category?: string | null;
}

interface ExportOptions {
  batteryName: string;
  batteryDescription?: string | null;
  categoryName?: string | null;
  levels?: BatteryLevel[];
  items: BatteryItemDef[];
  rows: TestRow[];
  testMeta?: Record<string, { description?: string | null; objectives?: string | null; image_url?: string | null }>;
  categoryId?: string | null;
  clubId?: string | null;
}

/** Replace non-Latin1 characters that break Helvetica (e.g. ≥, ≤, →, …) */
function safe(text: string): string {
  return text
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/…/g, "...")
    .replace(/·/g, "•");
}
function st(pdf: jsPDF, text: string, x: number, y: number, opts?: any) {
  pdf.text(safe(text), x, y, opts);
}

function parsePoints(notes: string | null): { points: number; max: number | null } {
  if (!notes) return { points: 0, max: null };
  const full = notes.match(/Score\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i);
  if (full) return { points: parseFloat(full[1].replace(",", ".")), max: parseFloat(full[2].replace(",", ".")) };
  const legacy = notes.match(/Score\s+(\d+(?:[.,]\d+)?)/i);
  if (legacy) return { points: parseFloat(legacy[1].replace(",", ".")), max: null };
  return { points: 0, max: null };
}

function parseTestName(notes: string | null): string {
  if (!notes) return "Test";
  const m = notes.match(/Test:\s*(.+?)\s*·/i);
  if (m) return m[1].trim();
  return notes.replace(/^\[.*?\]\s*/, "").trim();
}

function isInjured(notes: string | null): boolean {
  return !!notes && /\[BLESS[ÉE]\]/i.test(notes);
}

function buildRadarPng(
  axes: { label: string; pct: number }[],
  size = 360,
  fillColor = "#3b82f6",
): string {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  // Plus petit rayon pour laisser place aux labels (évite la coupure)
  const radius = size * 0.28;
  const n = Math.max(axes.length, 3);

  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  for (let level = 1; level <= 5; level++) {
    const r = (radius * level) / 5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.strokeStyle = "#9ca3af";
  for (let i = 0; i < n; i++) {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.stroke();
  }

  ctx.beginPath();
  axes.forEach((a, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const r = (radius * Math.max(0, Math.min(100, a.pct))) / 100;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fillColor + "40";
  ctx.fill();
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  axes.forEach((a, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const r = (radius * Math.max(0, Math.min(100, a.pct))) / 100;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Helper: wrap label sur max 2 lignes en respectant une largeur max
  const wrapLabel = (text: string, maxWidth: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = w;
        if (lines.length === 1) break;
      }
    }
    if (current && lines.length < 2) lines.push(current);
    // Si le texte restant n'a pas pu rentrer, tronquer la dernière ligne
    if (lines.length === 2) {
      const totalUsed = lines.join(" ");
      if (totalUsed.length < text.length) {
        let last = lines[1];
        while (ctx.measureText(last + "...").width > maxWidth && last.length > 0) {
          last = last.slice(0, -1);
        }
        lines[1] = last + "...";
      }
    } else if (lines.length === 1 && ctx.measureText(lines[0]).width > maxWidth) {
      let l = lines[0];
      while (ctx.measureText(l + "...").width > maxWidth && l.length > 0) l = l.slice(0, -1);
      lines[0] = l + "...";
    }
    return lines;
  };

  ctx.fillStyle = "#111827";
  ctx.font = "10px Arial";
  const maxLabelWidth = (size - radius * 2) / 2 - 6; // espace dispo de chaque côté
  axes.forEach((a, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const lr = radius + 12;
    const x = cx + lr * Math.cos(angle);
    const y = cy + lr * Math.sin(angle);
    const lines = wrapLabel(a.label, maxLabelWidth);
    lines.forEach((line, li) => {
      const tw = ctx.measureText(line).width;
      let tx = x;
      if (Math.abs(Math.cos(angle)) < 0.3) tx = x - tw / 2;
      else if (Math.cos(angle) < 0) tx = x - tw;
      const ty = y + 4 + (li - (lines.length - 1) / 2) * 11;
      ctx.fillText(line, tx, ty);
    });
  });

  return canvas.toDataURL("image/png");
}

// ===== HTML → jsPDF rich text renderer =====
type RtStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  size: number;
  color: [number, number, number];
  align: "left" | "center" | "right" | "justify";
};
type RtToken =
  | { type: "text"; text: string; style: RtStyle }
  | { type: "break"; style: RtStyle }
  | { type: "para"; style: RtStyle; bullet?: string };

function cloneStyle(s: RtStyle): RtStyle {
  return { ...s, color: [...s.color] as [number, number, number] };
}
function parseColor(v: string | null): [number, number, number] | null {
  if (!v) return null;
  v = v.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(",").map((x) => parseFloat(x.trim()));
    return [p[0] | 0, p[1] | 0, p[2] | 0];
  }
  return null;
}
function applyInlineStyle(style: RtStyle, attr: string | null): RtStyle {
  if (!attr) return style;
  const out = cloneStyle(style);
  attr.split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).trim();
    if (k === "font-weight") {
      const n = parseInt(v, 10);
      out.bold = !isNaN(n) ? n >= 600 : /bold/i.test(v);
    } else if (k === "font-style") {
      out.italic = /italic|oblique/i.test(v);
    } else if (k === "text-decoration" || k === "text-decoration-line") {
      if (/underline/i.test(v)) out.underline = true;
      if (/none/i.test(v)) out.underline = false;
    } else if (k === "font-size") {
      const m = v.match(/(\d+(?:\.\d+)?)\s*(px|pt|em|rem)?/);
      if (m) {
        const n = parseFloat(m[1]);
        const unit = (m[2] || "px").toLowerCase();
        let pt = n;
        if (unit === "px") pt = n * 0.75;
        else if (unit === "em" || unit === "rem") pt = n * 12;
        out.size = Math.max(6, Math.min(28, pt));
      }
    } else if (k === "text-align") {
      if (/^(left|right|center|justify)$/i.test(v)) out.align = v.toLowerCase() as RtStyle["align"];
    } else if (k === "color") {
      const c = parseColor(v);
      if (c) out.color = c;
    }
  });
  return out;
}

function tokenizeHtml(html: string, base: RtStyle): RtToken[] {
  const tokens: RtToken[] = [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  } catch {
    tokens.push({ type: "text", text: html.replace(/<[^>]+>/g, " "), style: base });
    return tokens;
  }
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return tokens;

  const blockTags = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre"]);

  let pendingBullet: string | undefined;
  let listDepth = 0;

  const walk = (node: Node, style: RtStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || "").replace(/\s+/g, " ");
      if (txt) tokens.push({ type: "text", text: txt, style });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      tokens.push({ type: "break", style });
      return;
    }

    let s = cloneStyle(style);
    if (tag === "strong" || tag === "b") s.bold = true;
    if (tag === "em" || tag === "i") s.italic = true;
    if (tag === "u" || tag === "ins") s.underline = true;
    if (tag === "h1") { s.bold = true; s.size = Math.max(s.size, 14); }
    if (tag === "h2") { s.bold = true; s.size = Math.max(s.size, 13); }
    if (tag === "h3") { s.bold = true; s.size = Math.max(s.size, 12); }
    s = applyInlineStyle(s, el.getAttribute("style"));
    const align = el.getAttribute("align");
    if (align && /^(left|right|center|justify)$/i.test(align)) {
      s.align = align.toLowerCase() as RtStyle["align"];
    }

    const isBlock = blockTags.has(tag);
    const isList = tag === "ul" || tag === "ol";
    if (isBlock) tokens.push({ type: "para", style: s, bullet: pendingBullet });
    pendingBullet = undefined;

    if (isList) listDepth++;
    let liIdx = 0;
    el.childNodes.forEach((child) => {
      if (isList && (child as HTMLElement).tagName?.toLowerCase() === "li") {
        liIdx++;
        pendingBullet = tag === "ol" ? `${liIdx}.` : "•";
      }
      walk(child, s);
    });
    if (isList) listDepth--;

    if (isBlock) tokens.push({ type: "para", style: s });
  };

  root.childNodes.forEach((n) => walk(n, base));
  // Compact consecutive paras
  const out: RtToken[] = [];
  for (const t of tokens) {
    if (t.type === "para" && out.length && out[out.length - 1].type === "para" && !t.bullet) continue;
    out.push(t);
  }
  return out;
}

function setRunFont(pdf: jsPDF, s: RtStyle) {
  const style = s.bold && s.italic ? "bolditalic" : s.bold ? "bold" : s.italic ? "italic" : "normal";
  pdf.setFont("helvetica", style);
  pdf.setFontSize(s.size);
  pdf.setTextColor(s.color[0], s.color[1], s.color[2]);
}

/**
 * Render rich HTML inside a box. Returns the new Y after drawing.
 * Handles auto page-break via onNeedPage callback.
 */
function renderRichHtml(
  pdf: jsPDF,
  html: string,
  x: number,
  y: number,
  width: number,
  baseStyle: Partial<RtStyle> | undefined,
  opts: {
    pageH: number;
    bottomMargin: number;
    onNewPage: () => { x: number; y: number; width: number };
  },
): number {
  const base: RtStyle = {
    bold: false,
    italic: false,
    underline: false,
    size: baseStyle?.size ?? 10,
    color: baseStyle?.color ?? [60, 60, 60],
    align: baseStyle?.align ?? "left",
  };
  const tokens = tokenizeHtml(html, base);

  let cursorX = x;
  let cursorY = y;
  let curX = x;
  let curWidth = width;
  let lineGap = 2;

  // Buffer of segments for current line: { text, style, w }
  type Seg = { text: string; style: RtStyle; w: number; bullet?: string };
  let line: Seg[] = [];
  let lineH = 0;
  let lineAlign: RtStyle["align"] = "left";
  let pendingBullet: string | undefined;

  const ensureSpace = (h: number) => {
    if (cursorY + h > opts.pageH - opts.bottomMargin) {
      const nx = opts.onNewPage();
      curX = nx.x;
      curWidth = nx.width;
      cursorX = nx.x;
      cursorY = nx.y;
    }
  };

  const flushLine = () => {
    if (line.length === 0) {
      cursorY += (lineH || 12) + lineGap;
      lineH = 0;
      cursorX = curX;
      return;
    }
    ensureSpace(lineH);
    let totalW = line.reduce((a, b) => a + b.w, 0);
    let startX = curX;
    if (lineAlign === "center") startX = curX + (curWidth - totalW) / 2;
    else if (lineAlign === "right") startX = curX + (curWidth - totalW);
    let bx = startX;
    if (pendingBullet) {
      setRunFont(pdf, line[0].style);
      pdf.text(pendingBullet, curX, cursorY + lineH * 0.8);
      pendingBullet = undefined;
    }
    for (const seg of line) {
      setRunFont(pdf, seg.style);
      const baselineY = cursorY + lineH * 0.8;
      pdf.text(seg.text, bx, baselineY);
      if (seg.style.underline) {
        const uy = baselineY + 1.5;
        pdf.setDrawColor(seg.style.color[0], seg.style.color[1], seg.style.color[2]);
        pdf.setLineWidth(0.5);
        pdf.line(bx, uy, bx + seg.w, uy);
      }
      bx += seg.w;
    }
    cursorY += lineH + lineGap;
    cursorX = curX;
    line = [];
    lineH = 0;
  };

  const pushTextRun = (rawText: string, style: RtStyle) => {
    if (!rawText) return;
    setRunFont(pdf, style);
    // Split on spaces but keep them with the previous word for natural wrapping
    const words = rawText.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      const ww = pdf.getTextWidth(safe(w));
      const usedW = line.reduce((a, b) => a + b.w, 0);
      const indent = pendingBullet ? 14 : 0;
      if (usedW + ww > curWidth - indent && line.length > 0 && !/^\s+$/.test(w)) {
        flushLine();
      }
      // Skip leading whitespace at start of new line
      if (line.length === 0 && /^\s+$/.test(w)) continue;
      line.push({ text: safe(w), style, w: ww });
      lineAlign = style.align;
      lineH = Math.max(lineH, style.size + 2);
    }
  };

  for (const t of tokens) {
    if (t.type === "para") {
      flushLine();
      if (t.bullet) {
        pendingBullet = t.bullet;
        // indent line content
        // (handled in flushLine via curX offset)
      }
    } else if (t.type === "break") {
      flushLine();
    } else if (t.type === "text") {
      pushTextRun(t.text, t.style);
    }
  }
  flushLine();
  return cursorY;
}

/** Strip HTML to detect emptiness */
function htmlIsEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  return !html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** Load image as data URL (handles cross-origin via canvas) */
async function loadImageAsDataUrl(src: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportBatteryReportPdf(opts: ExportOptions): Promise<void> {
  const { batteryName, batteryDescription, categoryName, levels, items, rows } = opts;

  type Group = {
    playerId: string;
    playerName: string;
    avatarUrl: string | null;
    date: string;
    rows: TestRow[];
  };
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = `${r.player_id}__${r.test_date}`;
    const playerName = r.players?.first_name
      ? `${r.players.first_name} ${r.players.name}`
      : r.players?.name || "Athlete";
    if (!map.has(key)) map.set(key, {
      playerId: r.player_id,
      playerName,
      avatarUrl: r.players?.avatar_url || null,
      date: r.test_date,
      rows: [],
    });
    map.get(key)!.rows.push(r);
  }
  const groups = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));

  // Authoritative max per item (one max per baseName, NOT per side)
  const maxByName: Record<string, number> = {};
  items.forEach(it => {
    if (it.test_name) maxByName[it.test_name.trim().toLowerCase()] = Number(it.max_points) || 0;
  });
  const totalMaxBattery = items.reduce((s, it) => s + (Number(it.max_points) || 0), 0);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;

  // Preload logo (club logo > PDF settings logo > app default)
  const logoData = await getReportLogoDataUrl({ categoryId: opts.categoryId, clubId: opts.clubId });

  // ===== Cover page =====
  const contentW = pageW - margin * 2;
  const logoW = 110;
  const logoH = 80;
  const titleMaxW = contentW - logoW - 16;

  if (logoData) {
    pdf.addImage(logoData, "PNG", pageW - margin - logoW, margin - 4, logoW, logoH);
  }

  // Titre + sous-titre dans la zone de gauche, à côté du logo
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(20);
  const titleLines = pdf.splitTextToSize(safe(categoryName || batteryName), titleMaxW);
  pdf.text(titleLines, margin, margin + 22);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(80);
  const subLines = pdf.splitTextToSize(safe(batteryName), titleMaxW);
  pdf.text(subLines, margin, margin + 22 + titleLines.length * 22 + 4);

  // Curseur Y dynamique sous le bloc titre/logo
  const headerBottom = Math.max(
    margin + 22 + titleLines.length * 22 + 4 + subLines.length * 16,
    margin - 4 + logoH,
  );
  let coverY = headerBottom + 24;

  // Description (HTML rich text supporté : gras, souligné, taille, etc.)
  if (!htmlIsEmpty(batteryDescription)) {
    coverY = renderRichHtml(pdf, String(batteryDescription), margin, coverY, contentW,
      { size: 11, color: [110, 110, 110], align: "left" },
      {
        pageH,
        bottomMargin: margin,
        onNewPage: () => { pdf.addPage(); return { x: margin, y: margin, width: contentW }; },
      },
    );
    coverY += 10;
  }

  pdf.setTextColor(60);
  st(pdf, `Genere le ${format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })}`, margin, coverY);
  coverY += 16;
  st(pdf, `${groups.length} passation(s) - ${items.length} tests - ${totalMaxBattery} pts max`, margin, coverY);
  coverY += 28;

  const lvls = (levels && levels.length > 0)
    ? [...levels].sort((a, b) => b.minPercent - a.minPercent)
    : undefined;
  if (lvls && lvls.length > 0) {
    // Si on n'a plus la place pour le titre + au moins une ligne, on passe à une nouvelle page
    if (coverY > pageH - margin - 60) {
      pdf.addPage();
      coverY = margin;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(20);
    st(pdf, "Bareme de niveaux", margin, coverY);
    coverY += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    lvls.forEach((lv) => {
      if (coverY > pageH - margin - 20) {
        pdf.addPage();
        coverY = margin;
      }
      const color = hexToRgb(lv.color || "#3b82f6");
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.rect(margin, coverY - 9, 12, 12, "F");
      pdf.setTextColor(20);
      st(pdf, `${lv.label} - >= ${lv.minPercent}%`, margin + 20, coverY);
      coverY += 18;
    });
  }

  // ===== Page(s) "Présentation des tests" =====
  const meta = opts.testMeta || {};
  const presentationItems = items
    .map((it) => {
      const key = (it.test_name || "").trim().toLowerCase();
      return {
        name: it.test_name,
        max: Number(it.max_points) || 0,
        description: meta[key]?.description || null,
        objectives: meta[key]?.objectives || null,
        image_url: meta[key]?.image_url || null,
      };
    })
    .filter((it) => !!it.name);

  // Préchargement des images des tests (en parallèle)
  const testImages: Record<string, { data: string; w: number; h: number } | null> = {};
  await Promise.all(
    presentationItems
      .filter((it) => !!it.image_url)
      .map(async (it) => {
        const data = await loadImageAsDataUrl(it.image_url!);
        testImages[(it.name || "").trim().toLowerCase()] = data;
      }),
  );

  if (presentationItems.length > 0) {
    // Toujours commencer la présentation des tests page 2
    pdf.addPage();
    let py: number = margin;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(20);
    st(pdf, "Presentation des tests", margin, py + 6);
    py += 24;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(110);
    st(pdf, "Description et objectifs de chaque test de la batterie", margin, py);
    py += 18;

    const IMG_BOX_W = 110;
    const IMG_BOX_H = 80;
    const TEXT_GAP = 12;

    presentationItems.forEach((it) => {
      const key = (it.name || "").trim().toLowerCase();
      const imgInfo = testImages[key] || null;

      // Calcul des dimensions affichées en respectant le ratio
      let dispW = 0;
      let dispH = 0;
      if (imgInfo) {
        const ratio = imgInfo.w / imgInfo.h;
        const boxRatio = IMG_BOX_W / IMG_BOX_H;
        if (ratio >= boxRatio) {
          dispW = IMG_BOX_W;
          dispH = IMG_BOX_W / ratio;
        } else {
          dispH = IMG_BOX_H;
          dispW = IMG_BOX_H * ratio;
        }
      }

      const textX = imgInfo ? margin + IMG_BOX_W + TEXT_GAP : margin + 10;
      const textW = imgInfo ? contentW - IMG_BOX_W - TEXT_GAP : contentW - 12;

      const hasDesc = !htmlIsEmpty(it.description);
      const hasObj = !htmlIsEmpty(it.objectives);

      // Saut de page seulement si pas la place pour titre + ~3 lignes
      const minNeeded = 60;
      const remaining = pageH - margin - py;
      if (remaining < minNeeded) {
        pdf.addPage();
        py = margin;
      }

      const blockTop = py;

      // Image à gauche, centrée dans la box pour respecter le ratio
      if (imgInfo) {
        try {
          const ix = margin + (IMG_BOX_W - dispW) / 2;
          const iy = blockTop + (IMG_BOX_H - dispH) / 2;
          pdf.addImage(imgInfo.data, "PNG", ix, iy, dispW, dispH);
        } catch {/* ignore */}
      }

      // Barre colorée + titre
      pdf.setFillColor(59, 130, 246);
      pdf.rect(textX - 6, blockTop, 3, 14, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(20);
      st(pdf, it.name, textX, blockTop + 10);
      if (it.max > 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(110);
        st(pdf, `${it.max} pts max`, pageW - margin, blockTop + 10, { align: "right" });
      }
      let ty = blockTop + 18;
      let curTextX = textX;
      let curTextW = textW;

      const onNewPage = () => {
        pdf.addPage();
        py = margin;
        // After page break, drop the image column constraint
        curTextX = margin;
        curTextW = contentW;
        return { x: curTextX, y: margin, width: curTextW };
      };

      if (hasDesc) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(80);
        st(pdf, "Description", curTextX, ty);
        ty += 11;
        ty = renderRichHtml(pdf, String(it.description), curTextX, ty, curTextW,
          { size: 9, color: [60, 60, 60], align: "left" },
          { pageH, bottomMargin: margin, onNewPage },
        );
        ty += 4;
      }

      if (hasObj) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(80);
        st(pdf, "Objectifs", curTextX, ty);
        ty += 11;
        ty = renderRichHtml(pdf, String(it.objectives), curTextX, ty, curTextW,
          { size: 9, color: [60, 60, 60], align: "left" },
          { pageH, bottomMargin: margin, onNewPage },
        );
        ty += 4;
      }

      if (!hasDesc && !hasObj) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        st(pdf, "Aucune description renseignee.", curTextX, ty);
        ty += 12;
      }

      // py = max entre fin texte et fin image, + petit espace
      py = Math.max(ty, blockTop + (imgInfo ? IMG_BOX_H : 0)) + 10;
    });
  }

  // ===== Multiple athletes per page (2-3 selon l'espace) =====
  let y = pageH; // force new page on first iteration

  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];

    // Build per-test data (merge bilateral by baseName) - max counted ONCE per item
    type ItemAgg = { name: string; points: number; max: number; results: string[]; injured: boolean };
    const aggMap = new Map<string, ItemAgg>();
    for (const r of g.rows) {
      const fullName = parseTestName(r.notes);
      const baseName = fullName.replace(/\s*\((Droit|Gauche)\)\s*$/i, "").trim();
      const { points } = parsePoints(r.notes);
      const inj = isInjured(r.notes);
      const cur = aggMap.get(baseName) || { name: baseName, points: 0, max: 0, results: [], injured: false };
      cur.points += points;
      cur.max = maxByName[baseName.toLowerCase()] ?? maxByName[fullName.toLowerCase()] ?? cur.max;
      if (r.result_value != null) cur.results.push(`${r.result_value}${r.result_unit ? " " + r.result_unit : ""}`);
      cur.injured = cur.injured || inj;
      aggMap.set(baseName, cur);
    }
    const aggItems = Array.from(aggMap.values());

    const totalPoints = aggItems.reduce((s, it) => s + it.points, 0);
    const finalMax = totalMaxBattery > 0 ? totalMaxBattery : aggItems.reduce((s, it) => s + it.max, 0);
    const pct = finalMax > 0 ? Math.round((totalPoints / finalMax) * 100) : 0;
    const level = getLevelForPercent(pct, levels);

    // Hauteur estimée du bloc athlète
    const linesH = 14 + aggItems.length * 24;
    const blockH = 64 + Math.max(240, linesH) + 18;

    if (y + blockH > pageH - margin) {
      pdf.addPage();
      y = margin;
    }

    // Avatar (left)
    let headerX = margin;
    if (g.avatarUrl) {
      const avatar = await loadImageAsDataUrl(g.avatarUrl);
      if (avatar) {
        try {
          pdf.addImage(avatar.data, "PNG", margin, y, 48, 48);
          headerX = margin + 58;
        } catch {/* ignore */}
      }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(20);
    st(pdf, g.playerName, headerX, y + 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(110);
    st(pdf, `${categoryName ? categoryName + " - " : ""}${batteryName} - ${format(new Date(g.date), "dd/MM/yyyy", { locale: fr })}`, headerX, y + 32);

    const lvlColor = hexToRgb(level.color || "#3b82f6");
    pdf.setFillColor(lvlColor.r, lvlColor.g, lvlColor.b);
    const badgeX = pageW - margin - 140;
    pdf.roundedRect(badgeX, y, 140, 48, 6, 6, "F");
    pdf.setTextColor(255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    st(pdf, `${Math.round(totalPoints)} / ${finalMax}`, badgeX + 70, y + 20, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    st(pdf, `${pct}% - ${level.label}`, badgeX + 70, y + 38, { align: "center" });

    y += 64;

    // Radar
    const radarData = aggItems.map(it => ({
      label: it.name,
      pct: it.max > 0 ? Math.round((it.points / it.max) * 100) : 0,
    }));
    const radarPng = buildRadarPng(radarData, 360, level.color || "#3b82f6");
    const radarSize = 240;
    pdf.addImage(radarPng, "PNG", pageW - margin - radarSize, y, radarSize, radarSize);

    // Test rows on left side
    const tableW = pageW - margin * 2 - radarSize - 16;
    let ty = y;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    st(pdf, "Detail des tests", margin, ty);
    ty += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    aggItems.forEach((it) => {
      const itemPct = it.max > 0 ? Math.round((it.points / it.max) * 100) : 0;
      const itemLevel = getLevelForPercent(itemPct, levels);
      const c = hexToRgb(itemLevel.color || "#3b82f6");

      pdf.setFillColor(c.r, c.g, c.b);
      pdf.circle(margin + 4, ty - 3, 3, "F");

      pdf.setTextColor(20);
      pdf.setFont("helvetica", "bold");
      const nameW = tableW - 110;
      const nameLines = pdf.splitTextToSize(safe(it.name), nameW);
      pdf.text(nameLines[0], margin + 12, ty);

      pdf.setFont("helvetica", "normal");
      const scoreText = it.injured
        ? "Blesse"
        : `${Math.round(it.points)}${it.max > 0 ? "/" + it.max : ""} pts (${itemPct}%)`;
      pdf.setTextColor(c.r, c.g, c.b);
      st(pdf, scoreText, margin + tableW, ty, { align: "right" });

      ty += 11;
      pdf.setTextColor(120);
      pdf.setFontSize(8);
      const resultText = it.results.length > 0 ? `Resultat: ${it.results.join(" / ")}` : "-";
      st(pdf, resultText, margin + 12, ty);
      pdf.setFontSize(9);
      ty += 13;
    });

    const blockEnd = Math.max(ty, y + radarSize);

    // Séparateur visuel si un autre athlète tient sur la page
    if (idx < groups.length - 1) {
      pdf.setDrawColor(220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, blockEnd + 8, pageW - margin, blockEnd + 8);
    }

    y = blockEnd + 18;
  }

  // Numérotation finale de toutes les pages (générique)
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    st(pdf, `Page ${p} / ${totalPages}`, pageW - margin, pageH - 14, { align: "right" });
  }

  const fileName = `Rapport_${(categoryName || batteryName).replace(/[^a-z0-9]+/gi, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  pdf.save(fileName);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
