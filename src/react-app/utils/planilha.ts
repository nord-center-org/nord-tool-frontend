/**
 * Planilhas do bloco de notas (v3), no estilo do Google Sheets (editor Fortune-sheet). Regras puras, testáveis em
 * node: fórmulas escritas em português, o que é salvo de cada aba e a ida e volta do Excel (.xlsx).
 */
import * as XLSX from "xlsx";

/** Célula do Fortune-sheet (só o que usamos aqui). */
export interface CelulaFs {
  v?: string | number | boolean | null;
  m?: string | number | null;
  f?: string;
  ct?: { fa?: string; t?: string };
  [k: string]: unknown;
}
export interface CelulaComPosicao { r: number; c: number; v: CelulaFs | null }
export interface AbaFs {
  name: string;
  id?: string;
  order?: number;
  status?: number;
  row?: number;
  column?: number;
  celldata?: CelulaComPosicao[];
  data?: (CelulaFs | null)[][];
  config?: { merge?: Record<string, { r: number; c: number; rs: number; cs: number }>; columnlen?: Record<string, number>; rowlen?: Record<string, number>; [k: string]: unknown };
  [k: string]: unknown;
}

export const MAX_BYTES_PLANILHA = 5_000_000;

export const planilhaVazia = (): AbaFs[] => [{ name: "Página1", id: "p1", order: 0, status: 1, row: 100, column: 26, celldata: [], config: {} }];

/** O que vem do banco (JSON das abas); vazio ou estragado vira uma planilha nova. */
export function lerPlanilha(texto: string | null | undefined): AbaFs[] {
  if (!texto) return planilhaVazia();
  try {
    const abas: unknown = JSON.parse(texto);
    if (!Array.isArray(abas) || !abas.length) return planilhaVazia();
    return abas.filter((a): a is AbaFs => !!a && typeof a === "object" && typeof (a as AbaFs).name === "string")
      .map((a, i) => ({ ...a, order: a.order ?? i, celldata: Array.isArray(a.celldata) ? a.celldata : [] }));
  } catch {
    return planilhaVazia();
  }
}

/** Campos da aba que valem a pena guardar (a grade cheia "data" vira só as células preenchidas). */
const CAMPOS = ["name", "id", "order", "color", "status", "hide", "row", "column", "config", "frozen", "images", "filter_select", "filter",
  "luckysheet_conditionformat_save", "dataVerification", "hyperlink", "defaultRowHeight", "defaultColWidth", "zoomRatio", "showGridLines"];

/** Abas prontas para salvar: só as células com conteúdo ou formato, sem a grade inteira. */
export function abasParaSalvar(abas: AbaFs[]): AbaFs[] {
  return abas.map((a, i) => {
    const s: AbaFs = { name: a.name };
    for (const k of CAMPOS) if (a[k] !== undefined && a[k] !== null) s[k] = a[k];
    s.order = a.order ?? i;
    if (a.data) {
      const cel: CelulaComPosicao[] = [];
      a.data.forEach((linha, r) => linha?.forEach((v, c) => { if (v && Object.keys(v).length) cel.push({ r, c, v }); }));
      s.celldata = cel;
    } else s.celldata = a.celldata ?? [];
    return s;
  });
}

// ---------- fórmulas em português ----------

/** Nomes do Google Sheets / Excel em português → nomes do editor (inglês). */
export const FUNCOES_PT: Record<string, string> = {
  "SOMA": "SUM", "SOMASE": "SUMIF", "SOMASES": "SUMIFS", "SOMARPRODUTO": "SUMPRODUCT", "MÉDIA": "AVERAGE", "MEDIA": "AVERAGE",
  "MÉDIASE": "AVERAGEIF", "MEDIASE": "AVERAGEIF", "MÁXIMO": "MAX", "MAXIMO": "MAX", "MÍNIMO": "MIN", "MINIMO": "MIN",
  "CONT.NÚM": "COUNT", "CONT.NUM": "COUNT", "CONT.VALORES": "COUNTA", "CONTAR.VAZIO": "COUNTBLANK", "CONT.SE": "COUNTIF",
  "CONT.SES": "COUNTIFS", "SE": "IF", "SEERRO": "IFERROR", "E": "AND", "OU": "OR", "NÃO": "NOT", "NAO": "NOT",
  "ARRED": "ROUND", "ARREDONDAR.PARA.CIMA": "ROUNDUP", "ARREDONDAR.PARA.BAIXO": "ROUNDDOWN", "TRUNCAR": "TRUNC", "INT": "INT",
  "ABS": "ABS", "RAIZ": "SQRT", "POTÊNCIA": "POWER", "POTENCIA": "POWER", "MOD": "MOD", "PRODUTO": "PRODUCT",
  "PROCV": "VLOOKUP", "PROCH": "HLOOKUP", "ÍNDICE": "INDEX", "INDICE": "INDEX", "CORRESP": "MATCH",
  "CONCATENAR": "CONCATENATE", "ESQUERDA": "LEFT", "DIREITA": "RIGHT", "EXT.TEXTO": "MID", "NÚM.CARACT": "LEN", "NUM.CARACT": "LEN",
  "MAIÚSCULA": "UPPER", "MAIUSCULA": "UPPER", "MINÚSCULA": "LOWER", "MINUSCULA": "LOWER", "ARRUMAR": "TRIM", "TEXTO": "TEXT",
  "VALOR": "VALUE", "SUBSTITUIR": "SUBSTITUTE", "HOJE": "TODAY", "AGORA": "NOW", "DATA": "DATE", "DIA": "DAY", "MÊS": "MONTH",
  "MES": "MONTH", "ANO": "YEAR", "DIATRABALHOTOTAL": "NETWORKDAYS", "DIA.DA.SEMANA": "WEEKDAY", "MAIOR": "LARGE", "MENOR": "SMALL",
  "MED": "MEDIAN", "DESVPAD": "STDEV", "ÉCÉL.VAZIA": "ISBLANK", "ÉNÚM": "ISNUMBER", "PI": "PI", "ALEATÓRIO": "RAND",
};

const nomesPorTamanho = Object.keys(FUNCOES_PT).sort((a, b) => b.length - a.length);
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reFuncao = new RegExp(`(^|[^A-Za-zÀ-ÿ0-9_.])(${nomesPorTamanho.map(escapar).join("|")})\\s*\\(`, "gi");

/** Aplica f só fora das aspas da fórmula. */
function foraDasAspas(formula: string, f: (trecho: string) => string): string {
  return formula.split(/("(?:[^"]|"")*")/).map((p, i) => (i % 2 ? p : f(p))).join("");
}

/**
 * Fórmula como se escreve no Sheets em português (=SOMA(A1:A3); =SE(B2>10;"sim";"não"); =A1*1,5) para a do editor
 * (=SUM(A1:A3); =IF(B2>10,"sim","não"); =A1*1.5). Com ";" de separador, a vírgula dos números vira ponto. Sem fórmula, volta igual.
 */
export function formulaParaIngles(valor: string): string {
  if (!valor.startsWith("=")) return valor;
  let usaPontoEVirgula = false;
  foraDasAspas(valor, t => { if (t.includes(";")) usaPontoEVirgula = true; return t; });
  return foraDasAspas(valor, t => {
    let s = t.replace(reFuncao, (_m, antes: string, nome: string) => `${antes}${FUNCOES_PT[nome.toUpperCase()] ?? nome}(`);
    if (usaPontoEVirgula) s = s.replace(/(\d),(\d)/g, "$1.$2").replace(/;/g, ",");
    return s;
  });
}

/** Precisa traduzir? (só fórmulas com nome em português ou ";"). */
export const temFormulaEmPortugues = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.startsWith("=") && formulaParaIngles(valor) !== valor;

// ---------- Excel ----------

const letraNum = (v: unknown) => (typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "g");

/** .xlsx (SheetJS) → abas do editor: valores, fórmulas, células mescladas e largura das colunas. */
export function xlsxParaAbas(wb: XLSX.WorkBook): AbaFs[] {
  const abas = wb.SheetNames.slice(0, 50).map((nome, i) => {
    const ws = wb.Sheets[nome];
    const ref = ws["!ref"];
    const celldata: CelulaComPosicao[] = [];
    let linhas = 100, colunas = 26;
    if (ref) {
      const faixa = XLSX.utils.decode_range(ref);
      linhas = Math.max(100, faixa.e.r + 20);
      colunas = Math.max(26, faixa.e.c + 5);
      for (let r = faixa.s.r; r <= Math.min(faixa.e.r, 20000); r++) {
        for (let c = faixa.s.c; c <= Math.min(faixa.e.c, 500); c++) {
          const cel = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
          if (!cel || (cel.v === undefined && !cel.f)) continue;
          const v: CelulaFs = { v: (cel.v as string | number | boolean | undefined) ?? null, m: cel.w ?? (cel.v == null ? "" : String(cel.v)), ct: { fa: cel.z ? String(cel.z) : "General", t: letraNum(cel.v) } };
          if (cel.f) v.f = `=${cel.f}`;
          celldata.push({ r, c, v });
        }
      }
    }
    const config: AbaFs["config"] = {};
    const merges = ws["!merges"] ?? [];
    if (merges.length) {
      config.merge = {};
      for (const m of merges) config.merge[`${m.s.r}_${m.s.c}`] = { r: m.s.r, c: m.s.c, rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 };
      for (const m of merges) {
        const alvo = celldata.find(x => x.r === m.s.r && x.c === m.s.c);
        if (alvo?.v) alvo.v.mc = { r: m.s.r, c: m.s.c, rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 };
      }
    }
    const cols = ws["!cols"] ?? [];
    if (cols.length) {
      config.columnlen = {};
      cols.forEach((c, j) => { if (c?.wpx) config.columnlen![j] = Math.round(c.wpx); else if (c?.wch) config.columnlen![j] = Math.round(c.wch * 7 + 5); });
    }
    return { name: nome.slice(0, 31) || `Página${i + 1}`, id: `p${i + 1}`, order: i, status: i === 0 ? 1 : 0, row: linhas, column: colunas, celldata, config };
  });
  return abas.length ? abas : planilhaVazia();
}

/** Abas do editor → .xlsx: valores e fórmulas (sem o "="), células mescladas e largura das colunas. */
export function abasParaXlsx(abas: AbaFs[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const a of [...abasParaSalvar(abas)].sort((x, y) => (x.order ?? 0) - (y.order ?? 0))) {
    const ws: XLSX.WorkSheet = {};
    let maxR = 0, maxC = 0;
    for (const { r, c, v } of a.celldata ?? []) {
      if (!v) continue;
      const valor = v.v ?? (v.m != null ? v.m : null);
      if (valor == null && !v.f) continue;
      const cel: XLSX.CellObject = typeof valor === "number" ? { t: "n", v: valor } : typeof valor === "boolean" ? { t: "b", v: valor } : { t: "s", v: valor == null ? "" : String(valor) };
      if (v.f) cel.f = v.f.replace(/^=/, "");
      ws[XLSX.utils.encode_cell({ r, c })] = cel;
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    const merge = a.config?.merge;
    if (merge) ws["!merges"] = Object.values(merge).map(m => ({ s: { r: m.r, c: m.c }, e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 } }));
    const colunas = a.config?.columnlen;
    if (colunas) ws["!cols"] = Array.from({ length: maxC + 1 }, (_, j) => (colunas[j] ? { wpx: colunas[j] } : {}));
    let nome = (a.name || "Página").replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Página";
    for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = `${nome.slice(0, 27)} (${n})`;
    usados.add(nome.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  return wb;
}

/**
 * Número escrito em português ("30,5", "-1.234,56", "1.250") → número; o resto (texto, "12", "1.5", fórmula) → null e
 * fica com o editor. Como no Sheets em português, o ponto separa milhar e a vírgula separa os decimais.
 */
export function numeroPtBr(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  let limpo: string | null = null;
  if (/^-?\d+,\d+$/.test(t)) limpo = t.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) limpo = t.replace(/\./g, "").replace(",", ".");
  if (limpo === null) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
