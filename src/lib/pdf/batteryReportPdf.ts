import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getLevelForPercent, type BatteryLevel } from "@/lib/constants/testUnits";
import logoLight from "@/assets/logo-light.png";

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
  testMeta?: Record<string, { description?: string | null; objectives?: string | null }>;
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

/** Load image as data URL (handles cross-origin via canvas) */
async function loadImageAsDataUrl(src: string): Promise<string | null> {
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
        resolve(c.toDataURL("image/png"));
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

  // Preload logo
  const logoData = await loadImageAsDataUrl(logoLight);

  // ===== Cover page =====
  if (logoData) {
    const logoW = 120;
    const logoH = 90;
    pdf.addImage(logoData, "PNG", pageW - margin - logoW, margin - 10, logoW, logoH);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(20);
  st(pdf, categoryName || batteryName, margin, margin + 24);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(80);
  st(pdf, batteryName, margin, margin + 46);

  pdf.setFontSize(11);
  pdf.setTextColor(110);
  if (batteryDescription) {
    const desc = pdf.splitTextToSize(safe(batteryDescription), pageW - margin * 2);
    pdf.text(desc, margin, margin + 70);
  }
  pdf.setTextColor(60);
  st(pdf, `Genere le ${format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })}`, margin, margin + 110);
  st(pdf, `${groups.length} passation(s) - ${items.length} tests - ${totalMaxBattery} pts max`, margin, margin + 126);

  const lvls = (levels && levels.length > 0)
    ? [...levels].sort((a, b) => b.minPercent - a.minPercent)
    : undefined;
  if (lvls && lvls.length > 0) {
    let y = margin + 162;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(20);
    st(pdf, "Bareme de niveaux", margin, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    lvls.forEach((lv) => {
      const color = hexToRgb(lv.color || "#3b82f6");
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.rect(margin, y - 9, 12, 12, "F");
      pdf.setTextColor(20);
      st(pdf, `${lv.label} - >= ${lv.minPercent}%`, margin + 20, y);
      y += 18;
    });
  }

  // ===== One page per athlete =====
  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    pdf.addPage();
    let y = margin;

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
      // Single source of truth: battery item def
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

    // Avatar (left)
    let headerX = margin;
    if (g.avatarUrl) {
      const avatar = await loadImageAsDataUrl(g.avatarUrl);
      if (avatar) {
        try {
          pdf.addImage(avatar, "PNG", margin, y, 48, 48);
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
      if (ty > pageH - 40) {
        pdf.addPage();
        ty = margin;
      }
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

    pdf.setFontSize(8);
    pdf.setTextColor(150);
    st(pdf, `Page ${idx + 2}`, pageW - margin, pageH - 14, { align: "right" });
  }

  pdf.setPage(1);
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  st(pdf, "Page 1", pageW - margin, pageH - 14, { align: "right" });

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
