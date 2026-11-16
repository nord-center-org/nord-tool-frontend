/**
 * Planilhas do bloco de notas (v3), no estilo do Google Sheets (editor Fortune-sheet). Regras puras, testáveis em
 * node: fórmulas escritas em português, o que é salvo de cada aba e a ida e volta do Excel (.xlsx).
 */
import * as XLSX from "xlsx";

import { FUNCOES } from "./funcoesPlanilha.ts";

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

/** Correção: planilha nova do tamanho da do Google Sheets (1000 linhas, 26 colunas); antes eram só 100 linhas. */
export const LINHAS_NOVA = 1000;
export const COLUNAS_NOVA = 26;
export const planilhaVazia = (): AbaFs[] => [{ name: "Página1", id: "p1", order: 0, status: 1, row: LINHAS_NOVA, column: COLUNAS_NOVA, celldata: [], config: {} }];

/** Quantas linhas (ou colunas) a seleção tem: o "Inserir N linhas" já vem com esse número, como no Google Sheets. */
export function quantidadeSelecionada(faixa: [number, number] | number[] | undefined): number {
  if (!faixa || faixa.length < 2) return 1;
  return Math.max(1, Math.min(1000, Math.abs(Number(faixa[1]) - Number(faixa[0])) + 1));
}

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

/**
 * v5: português de verdade. A célula guarda a fórmula com o nome em português (=SOMA(A1,B1)); o motor do editor só
 * entende inglês, então ela é traduzida na hora do cálculo (formulaParaMotor). A pessoa pode digitar como no Sheets em
 * português, com ";" entre os argumentos e vírgula decimal: =SE(A1>1,5;"sim";"não"). O separador gravado continua a
 * vírgula, porque o editor só acha as células usadas (e recalcula) separando por vírgula.
 */
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Nome em português (com e sem acento, e os nomes antigos) → nome do motor. */
export const FUNCOES_PT: Record<string, string> = (() => {
  const m: Record<string, string> = {
    PRODUTO: "PRODUCT", DESVPAD: "STDEV", "DESVPAD.A": "STDEV.S", "DESVPAD.P": "STDEV.P", MODO: "MODE.SNGL", "ORDEM": "RANK.EQ",
    PERCENTIL: "PERCENTILE.INC", QUARTIL: "QUARTILE.INC", VAR: "VAR.S", "PROCURAR.TEXTO": "FIND",
  };
  for (const [motor, [pt]] of Object.entries(FUNCOES)) { m[pt] = motor; m[semAcento(pt)] = motor; }
  return m;
})();

/** Nome do motor → nome em português (só as funções que têm nome em português). */
export const FUNCOES_EN: Record<string, string> = Object.fromEntries(Object.entries(FUNCOES).map(([motor, [pt]]) => [motor, pt]));

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reNomes = (nomes: string[]) =>
  new RegExp(`(^|[^A-Za-zÀ-ÿ0-9_.])(${[...nomes].sort((a, b) => b.length - a.length).map(escapar).join("|")})(?=\\s*\\()`, "gi");
const rePt = reNomes(Object.keys(FUNCOES_PT));
/**
 * VERDADEIRO e FALSO soltos (valores), fora de nomes de células e páginas. O motor só entende TRUE() e FALSE() (com
 * parênteses): TRUE sozinho dá #NOME?.
 */
const reLogicoPt = /(^|[^A-Za-zÀ-ÿ0-9_.$!'])(VERDADEIRO|FALSO|TRUE|FALSE)(?![A-Za-zÀ-ÿ0-9_.(!])/gi;
const reLogicoEn = /(^|[^A-Za-zÀ-ÿ0-9_.$!'])(TRUE|FALSE|VERDADEIRO|FALSO)(\s*\(\s*\))?(?![A-Za-zÀ-ÿ0-9_.(!])/gi;
const reEn = reNomes(Object.keys(FUNCOES_EN));

/** Aplica f só fora das aspas da fórmula. */
function foraDasAspas(formula: string, f: (trecho: string) => string): string {
  return formula.split(/("(?:[^"]|"")*")/).map((p, i) => (i % 2 ? p : f(p))).join("");
}

/**
 * Fórmula da célula (ou como a pessoa digitou) → a do motor: =SOMA(A1:A3) → =SUM(A1:A3); =SE(B2>10;"sim";"não") →
 * =IF(B2>10,"sim","não"); =ARRED(A1*1,5;2) → =ROUND(A1*1.5,2). Com ";" de separador, a vírgula dos números vira ponto.
 * Nomes em inglês passam iguais. Sem "=", volta igual.
 */
export function formulaParaMotor(valor: string): string {
  if (!valor.startsWith("=")) return valor;
  let usaPontoEVirgula = false;
  foraDasAspas(valor, t => { if (t.includes(";")) usaPontoEVirgula = true; return t; });
  return foraDasAspas(valor, t => {
    let s = t.replace(rePt, (_m, antes: string, nome: string) => `${antes}${FUNCOES_PT[nome.toUpperCase()] ?? FUNCOES_PT[semAcento(nome.toUpperCase())] ?? nome}`)
      .replace(reLogicoPt, (_m, antes: string, v: string) => `${antes}${/^(FALSO|FALSE)$/i.test(v) ? "FALSE" : "TRUE"}()`);
    if (usaPontoEVirgula) s = s.replace(/(\d),(\d)/g, "$1.$2").replace(/;/g, ",");
    return s;
  });
}

/** Nome antigo (v3): continua valendo. */
export const formulaParaIngles = formulaParaMotor;

/** Fórmula do motor (ou do Excel) → como fica na célula: nomes em português, mesmos separadores. */
export function formulaParaPortugues(valor: string): string {
  if (!valor.startsWith("=")) return valor;
  return foraDasAspas(valor, t => t.replace(reLogicoEn, (_m, antes: string, v: string) => `${antes}${/^(FALSE|FALSO)$/i.test(v) ? "FALSO" : "VERDADEIRO"}`)
    .replace(reEn, (_m, antes: string, nome: string) => `${antes}${FUNCOES_EN[nome.toUpperCase()] ?? nome}`));
}

/** O que a pessoa digitou → o que fica na célula: nomes em português, ";" vira "," e "1,5" vira 1.5. */
export const normalizarFormula = (valor: string): string => formulaParaPortugues(formulaParaMotor(valor));

/** Precisa mexer no que foi digitado? (fórmula com ";", vírgula decimal ou nome em inglês). */
export const precisaNormalizar = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.startsWith("=") && normalizarFormula(valor) !== valor;

/** Nome antigo (v3). */
export const temFormulaEmPortugues = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.startsWith("=") && formulaParaMotor(valor) !== valor;

/**
 * Abas prontas para o editor: fórmulas em português, cada aba com id e a lista das células com fórmula (calcChain).
 * Sem essa lista o editor não refaz as contas quando um valor muda (a lista não é salva; é montada ao abrir).
 */
export function prepararAbas(abas: AbaFs[]): AbaFs[] {
  const usados = new Set<string>();
  return abasEmPortugues(abas).map((a, i) => {
    let id = typeof a.id === "string" && a.id && !usados.has(a.id) ? a.id : `p${i + 1}`;
    while (usados.has(id)) id = `${id}x`;
    usados.add(id);
    const calcChain = (a.celldata ?? []).filter(c => typeof c.v?.f === "string" && c.v.f.startsWith("=")).map(c => ({ r: c.r, c: c.c, id }));
    return { ...a, id, calcChain };
  });
}

/** As fórmulas das abas no formato da célula (abrir planilhas antigas, em inglês, e o Excel). */
export function abasEmPortugues(abas: AbaFs[]): AbaFs[] {
  return abas.map(a => ({
    ...a,
    celldata: (a.celldata ?? []).map(c => (c.v?.f ? { ...c, v: { ...c.v, f: formulaParaPortugues(c.v.f) } } : c)),
  }));
}

/** Valores lógicos e erros como o Sheets em português mostra. */
const NA_TELA: Record<string, string> = {
  TRUE: "VERDADEIRO", FALSE: "FALSO", "#NAME?": "#NOME?", "#VALUE!": "#VALOR!", "#N/A": "#N/D", "#NUM!": "#NÚM!", "#NULL!": "#NULO!", "#ERROR!": "#ERRO!",
};

/** O que o editor vai desenhar numa célula, em português: números, VERDADEIRO/FALSO e erros. */
export const textoNaTela = (texto: string): string => NA_TELA[texto] ?? numeroNaTela(texto);

/**
 * Data digitada no jeito brasileiro ("11/11/2026", "5/3/26", "11/11/2026 14:30") → data ISO para o editor e o formato
 * para mostrar de volta. Data que não existe (31/02) ou outro texto → null.
 */
export function dataPtBr(valor: unknown): { iso: string; formato: string } | null {
  if (typeof valor !== "string") return null;
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(valor);
  if (!m) return null;
  const dia = Number(m[1]), mes = Number(m[2]);
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  const dois = (n: number | string) => String(n).padStart(2, "0");
  const data = `${ano}-${dois(mes)}-${dois(dia)}`;
  if (m[4] === undefined) return { iso: data, formato: "dd/MM/yyyy" };
  const hora = Number(m[4]), minuto = Number(m[5]), segundo = m[6] === undefined ? null : Number(m[6]);
  if (hora > 23 || minuto > 59 || (segundo !== null && segundo > 59)) return null;
  return segundo === null
    ? { iso: `${data} ${dois(hora)}:${dois(minuto)}`, formato: "dd/MM/yyyy hh:mm" }
    : { iso: `${data} ${dois(hora)}:${dois(minuto)}:${dois(segundo)}`, formato: "dd/MM/yyyy hh:mm:ss" };
}

/**
 * Número como aparece na tela, no jeito brasileiro: "1,234.5" → "1.234,5", "R$1,200.09" → "R$1.200,09", "12.5%" →
 * "12,5%". Só mexe no que é número (com moeda, sinal, parênteses e %); o resto volta igual.
 */
export function numeroNaTela(texto: string): string {
  if (!/^[-+(]?(R\$\s?|\$\s?)?[-+(]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?\)?$/.test(texto) || !/[.,]/.test(texto)) return texto;
  return texto.replace(/[.,]/g, c => (c === "." ? "," : "."));
}

// ---------- Excel ----------

const letraNum = (v: unknown) => (typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "g");

/** .xlsx (SheetJS) → abas do editor: valores, fórmulas, células mescladas e largura das colunas. */
export function xlsxParaAbas(wb: XLSX.WorkBook): AbaFs[] {
  const abas = wb.SheetNames.slice(0, 50).map((nome, i) => {
    const ws = wb.Sheets[nome];
    const ref = ws["!ref"];
    const celldata: CelulaComPosicao[] = [];
    let linhas = LINHAS_NOVA, colunas = COLUNAS_NOVA;
    if (ref) {
      const faixa = XLSX.utils.decode_range(ref);
      linhas = Math.max(LINHAS_NOVA, faixa.e.r + 20);
      colunas = Math.max(26, faixa.e.c + 5);
      for (let r = faixa.s.r; r <= Math.min(faixa.e.r, 20000); r++) {
        for (let c = faixa.s.c; c <= Math.min(faixa.e.c, 500); c++) {
          const cel = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
          if (!cel || (cel.v === undefined && !cel.f)) continue;
          const v: CelulaFs = { v: (cel.v as string | number | boolean | undefined) ?? null, m: cel.w ?? (cel.v == null ? "" : String(cel.v)), ct: { fa: cel.z ? String(cel.z) : "General", t: letraNum(cel.v) } };
          if (cel.f) v.f = formulaParaPortugues(`=${cel.f}`);
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
      if (v.f) cel.f = formulaParaMotor(v.f).replace(/^=/, "");
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
