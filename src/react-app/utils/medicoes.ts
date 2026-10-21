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
