/** Criador de avatar: opções, padrão por usuário, datas comemorativas e leitura segura do JSON salvo. */

export const PELES = { p1: "#f9dcc4", p2: "#f1c27d", p3: "#e0ac69", p4: "#c68642", p5: "#8d5524", p6: "#5c3a1e" } as const;
export const CORES_CABELO = {
  preto: "#1f1b18", castanho: "#5b3a1f", loiro: "#e3b866", ruivo: "#b5481f", grisalho: "#a8a8a8", azul: "#3b82f6", rosa: "#ec4899",
} as const;
export const FUNDOS = { azul: "#dbeafe", verde: "#dcfce7", amarelo: "#fef9c3", rosa: "#fce7f3", roxo: "#ede9fe", cinza: "#e2e8f0" } as const;

export const CABELOS = ["curto", "raspado", "moicano", "cacheado", "longo", "coque", "careca"] as const;
export const OLHOS = ["normal", "feliz", "piscando", "oculos"] as const;
export const BOCAS = ["sorriso", "aberta", "seria"] as const;
export const BARBAS = ["nenhuma", "bigode", "cavanhaque", "cheia"] as const;

/** Função na obra: define a roupa e a cor do capacete (cores usuais de canteiro). */
export const FUNCOES = {
  engenheiro: { rotulo: "Engenheiro(a)", camisa: "#1e3a8a", capacete: "#f8fafc", extra: "colete" },
  mestre: { rotulo: "Mestre / encarregado", camisa: "#334155", capacete: "#2563eb", extra: "prancheta" },
  pedreiro: { rotulo: "Pedreiro / servente", camisa: "#64748b", capacete: "#facc15", extra: "colete" },
  eletricista: { rotulo: "Eletricista", camisa: "#0f766e", capacete: "#f97316", extra: "raio" },
  operador: { rotulo: "Operador de máquinas", camisa: "#475569", capacete: "#f97316", extra: "colete" },
  seguranca: { rotulo: "Segurança do trabalho", camisa: "#166534", capacete: "#22c55e", extra: "cruz" },
  administrativo: { rotulo: "Administrativo", camisa: "#7c3aed", capacete: "#f8fafc", extra: "cracha" },
  estagiario: { rotulo: "Estagiário(a) / trainee", camisa: "#0284c7", capacete: "#e2e8f0", extra: "cracha" },
} as const;

export type Pele = keyof typeof PELES;
export type CorCabelo = keyof typeof CORES_CABELO;
export type Fundo = keyof typeof FUNDOS;
export type Funcao = keyof typeof FUNCOES;
export type Cabelo = (typeof CABELOS)[number];
export type Olhos = (typeof OLHOS)[number];
export type Boca = (typeof BOCAS)[number];
export type Barba = (typeof BARBAS)[number];

export interface AvatarConfig {
  pele: Pele; cabelo: Cabelo; corCabelo: CorCabelo; olhos: Olhos; boca: Boca; barba: Barba;
  funcao: Funcao; capacete: boolean; fundo: Fundo;
  /** Veste o tema das datas comemorativas (Natal, Páscoa…) quando for a época. */
  datas: boolean;
}

export type DataComemorativa = "natal" | "anoNovo" | "carnaval" | "pascoa" | "junina" | "halloween";
export const DATAS: Record<DataComemorativa, string> = {
  natal: "Natal", anoNovo: "Ano Novo", carnaval: "Carnaval", pascoa: "Páscoa", junina: "Festa junina", halloween: "Halloween",
};

const chaves = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];

/** Hash simples e estável (para o avatar padrão ser sempre o mesmo para a mesma pessoa). */
function hash(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}
const escolher = <T>(lista: readonly T[], semente: number, salto: number) => lista[(hash(semente + salto * 7919) % lista.length)];

/** Função provável a partir do nome do cargo. */
export function funcaoDoCargo(cargo: string | null | undefined): Funcao {
  const c = (cargo ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/estagi|trainee/.test(c)) return "estagiario";
  if (/engenh|coordenad|gerente|diretor/.test(c)) return "engenheiro";
  if (/mestre|encarregad|supervis/.test(c)) return "mestre";
  if (/eletric/.test(c)) return "eletricista";
  if (/operador|maquin/.test(c)) return "operador";
  if (/seguranc|\btst\b|tecnico de seg/.test(c)) return "seguranca";
  if (/pedreiro|servente|ajudante|carpinteiro|armador|pintor|encanador/.test(c)) return "pedreiro";
  return "administrativo";
}

export function avatarPadrao(idUsuario: number, cargo?: string | null): AvatarConfig {
  const s = Math.abs(Math.trunc(idUsuario)) || 1;
  return {
    pele: escolher(chaves(PELES), s, 1),
    cabelo: escolher(["curto", "cacheado", "longo", "raspado", "coque"] as const, s, 2),
    corCabelo: escolher(["preto", "castanho", "loiro", "ruivo"] as const, s, 3),
    olhos: escolher(["normal", "feliz"] as const, s, 4),
    boca: "sorriso",
    barba: escolher(["nenhuma", "nenhuma", "bigode", "cavanhaque"] as const, s, 5),
    funcao: funcaoDoCargo(cargo),
    capacete: true,
    fundo: escolher(chaves(FUNDOS), s, 6),
    datas: true,
  };
}

export function avatarAleatorio(sorteio: () => number = Math.random): AvatarConfig {
  const um = <T>(l: readonly T[]) => l[Math.floor(sorteio() * l.length) % l.length];
  return {
    pele: um(chaves(PELES)), cabelo: um(CABELOS), corCabelo: um(chaves(CORES_CABELO)), olhos: um(OLHOS), boca: um(BOCAS),
    barba: um(BARBAS), funcao: um(chaves(FUNCOES)), capacete: sorteio() < 0.8, fundo: um(chaves(FUNDOS)), datas: true,
  };
}

/** Lê o JSON salvo: o que faltar ou vier inválido cai no padrão da pessoa (nunca quebra a tela). */
export function lerAvatar(dsConfig: string | null | undefined, idUsuario: number, cargo?: string | null): AvatarConfig {
  const base = avatarPadrao(idUsuario, cargo);
  let bruto: Record<string, unknown> = {};
  try {
    const v = dsConfig ? JSON.parse(dsConfig) : {};
    if (v && typeof v === "object" && !Array.isArray(v)) bruto = v as Record<string, unknown>;
  } catch { /* JSON inválido: usa o padrão */ }
  const de = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T => (lista as readonly unknown[]).includes(v) ? (v as T) : padrao;
  return {
    pele: de(chaves(PELES), bruto.pele, base.pele),
    cabelo: de(CABELOS, bruto.cabelo, base.cabelo),
    corCabelo: de(chaves(CORES_CABELO), bruto.corCabelo, base.corCabelo),
    olhos: de(OLHOS, bruto.olhos, base.olhos),
    boca: de(BOCAS, bruto.boca, base.boca),
    barba: de(BARBAS, bruto.barba, base.barba),
    funcao: de(chaves(FUNCOES), bruto.funcao, base.funcao),
    capacete: typeof bruto.capacete === "boolean" ? bruto.capacete : base.capacete,
    fundo: de(chaves(FUNDOS), bruto.fundo, base.fundo),
    datas: typeof bruto.datas === "boolean" ? bruto.datas : base.datas,
  };
}

export const salvarAvatar = (c: AvatarConfig) => JSON.stringify(c);

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), mês 1-12. */
export function domingoDePascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return { mes, dia: ((h + l - 7 * m + 114) % 31) + 1 };
}

const diasEntre = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

/** Data comemorativa da época, a partir de uma data ISO (yyyy-mm-dd, no fuso de São Paulo). */
export function dataComemorativa(iso: string): DataComemorativa | null {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));
  const p = domingoDePascoa(ano);
  const pascoa = new Date(Date.UTC(ano, p.mes - 1, p.dia));
  const dPascoa = diasEntre(hoje, pascoa);
  if (dPascoa >= -7 && dPascoa <= 1) return "pascoa";
  // Carnaval: terça-feira é 47 dias antes da Páscoa; de sexta a quarta de cinzas.
  if (dPascoa >= -51 && dPascoa <= -46) return "carnaval";
  if ((mes === 12 && dia >= 27) || (mes === 1 && dia <= 3)) return "anoNovo";
  if (mes === 12) return "natal";
  if (mes === 6 || (mes === 7 && dia <= 10)) return "junina";
  if (mes === 10 && dia >= 24) return "halloween";
  return null;
}

/** Tema que o avatar veste: o da época, se a pessoa deixou ligado. `forcar` serve para a prévia no editor. */
export function temaDoAvatar(c: AvatarConfig, hojeIso: string, forcar?: DataComemorativa | "nenhuma"): DataComemorativa | null {
  if (forcar) return forcar === "nenhuma" ? null : forcar;
  return c.datas ? dataComemorativa(hojeIso) : null;
}
