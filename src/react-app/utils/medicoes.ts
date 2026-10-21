/** Regras puras das Medições (sem dependências de React, testáveis em node). */

export interface ItemMedicao {
  nrMedicao: number;
  cdContrato: string;
  nmRazaoSocial: string;
  nrContrato: string;
  dtMedicao: string;
  vlMedicao: number;
  txMemorial: string | null;
  cdStatus: string;
}

export const STATUS_PENDENTE = "PENDENTE";

const centavos = (valor: number) => Math.round((valor || 0) * 100);

/** "R$14.000,05" — sem espaço, como se digita na observação do Sienge. */
export function moedaSienge(valor: number): string {
  const [inteiro, decimais] = (centavos(valor) / 100).toFixed(2).split(".");
  return `R$${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimais}`;
}

/** "Boletim medição 11 - 34515 - CLEAN XPRESS LTDA - CT/4916-209" */
export function tituloBoletim(m: Pick<ItemMedicao, "nrMedicao" | "cdContrato" | "nmRazaoSocial" | "nrContrato">): string {
  return `Boletim medição ${m.nrMedicao} - ${m.cdContrato} - ${m.nmRazaoSocial} - ${m.nrContrato}`;
}

/** "Obra: Medição de R$14.000,05 referente a …." (o ponto final é acrescentado se faltar). */
export function observacaoSienge(m: Pick<ItemMedicao, "vlMedicao" | "txMemorial">): string {
  const memorial = (m.txMemorial ?? "").trim();
  const base = `Obra: Medição de ${moedaSienge(m.vlMedicao)}`;
  if (!memorial) return `${base}.`;
  return /[.!?]$/.test(memorial) ? `${base} ${memorial}` : `${base} ${memorial}.`;
}

/** yyyy-MM-dd → dd/MM/yyyy (devolve o texto original se não for uma data ISO). */
export function dataIsoParaBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? "";
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/** Busca por título do boletim, memorial e data; status "" = todos. */
export function filtrarMedicoes<T extends ItemMedicao>(itens: T[], busca: string, cdStatus: string): T[] {
  const termo = semAcento(busca.trim());
  return itens.filter(m => {
    if (cdStatus && m.cdStatus !== cdStatus) return false;
    if (!termo) return true;
    const texto = semAcento(`${tituloBoletim(m)} ${m.txMemorial ?? ""} ${dataIsoParaBr(m.dtMedicao)}`);
    return termo.split(/\s+/).every(parte => texto.includes(parte));
  });
}

export interface ResumoMedicoes {
  total: number;
  valorTotal: number;
  /** Por código de status. */
  porStatus: Record<string, { quantidade: number; valor: number }>;
}

/** Soma em centavos (sem erro de ponto flutuante). */
export function resumirMedicoes(itens: Array<Pick<ItemMedicao, "cdStatus" | "vlMedicao">>): ResumoMedicoes {
  const porStatus: ResumoMedicoes["porStatus"] = {};
  let totalCentavos = 0;
  for (const m of itens) {
    const c = centavos(m.vlMedicao);
    totalCentavos += c;
    const atual = porStatus[m.cdStatus] ?? { quantidade: 0, valor: 0 };
    porStatus[m.cdStatus] = { quantidade: atual.quantidade + 1, valor: (centavos(atual.valor) + c) / 100 };
  }
  return { total: itens.length, valorTotal: totalCentavos / 100, porStatus };
}

/** Cor do chip: pendente âmbar, feita verde, qualquer status novo cinza. */
export function classeStatus(cdStatus: string): string {
  if (cdStatus === STATUS_PENDENTE) return "border-amber-200 bg-amber-50 text-amber-700";
  if (cdStatus === "FEITA") return "border-green-200 bg-green-50 text-green-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export interface ContratoConhecido {
  nrContrato: string;
  cdContrato: string;
  nmRazaoSocial: string;
  /** Maior nº de medição já lançado neste contrato + 1. */
  proximaMedicao: number;
}

/** Contratos já usados (um por nº de contrato, dados da medição mais recente), para preencher o cadastro. */
export function contratosConhecidos(itens: ItemMedicao[]): ContratoConhecido[] {
  const mapa = new Map<string, ContratoConhecido & { _data: string }>();
  for (const m of itens) {
    const chave = m.nrContrato.trim().toLocaleLowerCase("pt-BR");
    const atual = mapa.get(chave);
    const proxima = m.nrMedicao + 1;
    if (!atual) {
      mapa.set(chave, { nrContrato: m.nrContrato, cdContrato: m.cdContrato, nmRazaoSocial: m.nmRazaoSocial, proximaMedicao: proxima, _data: m.dtMedicao });
      continue;
    }
    atual.proximaMedicao = Math.max(atual.proximaMedicao, proxima);
    if (m.dtMedicao > atual._data) Object.assign(atual, { cdContrato: m.cdContrato, nmRazaoSocial: m.nmRazaoSocial, _data: m.dtMedicao });
  }
  return [...mapa.values()]
    .map(c => ({ nrContrato: c.nrContrato, cdContrato: c.cdContrato, nmRazaoSocial: c.nmRazaoSocial, proximaMedicao: c.proximaMedicao }))
    .sort((a, b) => a.nrContrato.localeCompare(b.nrContrato, "pt-BR", { numeric: true }));
}

/** Acha o contrato pelo número digitado (sem diferenciar caixa nem espaços nas pontas). */
export function acharContrato(contratos: ContratoConhecido[], nrContrato: string): ContratoConhecido | null {
  const chave = nrContrato.trim().toLocaleLowerCase("pt-BR");
  return chave ? contratos.find(c => c.nrContrato.trim().toLocaleLowerCase("pt-BR") === chave) ?? null : null;
}

/** Número em texto brasileiro ("36.500", "7000", "14,5") → número; nulo se inválido. */
function lerNumero(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d+(?:\.\d{3})*(?:,\d+)?$|^\d+(?:\.\d+)?$/.test(t)) return null;
  const normal = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t) || t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Calculadora de + - * / x × e parênteses, sem eval; nulo se a expressão for inválida ou dividir por zero. */
export function calcularExpressao(expressao: string): number | null {
  const fichas = expressao.replace(/[x×]/gi, "*").match(/\d[\d.,]*|[-+*/()]|\S/g);
  if (!fichas) return null;
  let i = 0;
  let falhou = false;
  const fator = (): number => {
    const f = fichas[i++];
    if (f === undefined) { falhou = true; return 0; }
    if (f === "-") return -fator();
    if (f === "(") {
      const v = soma();
      if (fichas[i++] !== ")") falhou = true;
      return v;
    }
    const n = /^\d/.test(f) ? lerNumero(f) : null;
    if (n === null) falhou = true;
    return n ?? 0;
  };
  const produto = (): number => {
    let v = fator();
    while (fichas[i] === "*" || fichas[i] === "/") {
      const op = fichas[i++];
      const d = fator();
      if (op === "/" && d === 0) falhou = true;
      v = op === "*" ? v * d : d === 0 ? 0 : v / d;
    }
    return v;
  };
  const soma = (): number => {
    let v = produto();
    while (fichas[i] === "+" || fichas[i] === "-") v = fichas[i++] === "+" ? v + produto() : v - produto();
    return v;
  };
  const resultado = soma();
  if (falhou || i !== fichas.length || !Number.isFinite(resultado)) return null;
  return Math.round(resultado * 100) / 100;
}

export interface AnaliseMemorial {
  /** Resultado da conta escrita no memorial (ex.: 73*500 → 36500). */
  conta: number | null;
  /** Valor informado depois do "=" (ex.: =36.500 → 36500), se houver. */
  informado: number | null;
}

/**
 * Procura no memorial a última conta entre parênteses — "(73*500=36.500)", "(7000/30*7)" — e a calcula.
 * Contas com texto no meio ou sem operador (só um número) são ignoradas.
 */
export function analisarMemorial(memorial: string | null | undefined): AnaliseMemorial {
  const vazio: AnaliseMemorial = { conta: null, informado: null };
  const grupos = [...(memorial ?? "").matchAll(/\(([^()]*)\)/g)].map(g => g[1]);
  for (let k = grupos.length - 1; k >= 0; k--) {
    const [esquerda, direita] = grupos[k].split("=", 2);
    if (!/[*/+\-x×]/i.test(esquerda.replace(/^\s*-/, ""))) continue;
    const conta = calcularExpressao(esquerda);
    if (conta === null) continue;
    const informado = direita === undefined ? null : lerNumero(direita.replace(/\s/g, ""));
    return { conta, informado };
  }
  return vazio;
}
