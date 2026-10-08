/** Regras puras do dashboard do Financeiro (sem React, testáveis em node). */
import { dataBrParaIso } from "./casamento.ts";
import { deslocarMes, rotuloMes } from "./financeiro.ts";

export const ROTULO_ORIGEM = {
  REAL: "Lançado",
  MEDIA: "Média dos meses",
  RECORRENCIA: "Valor fixo",
  RITMO: "Ritmo do ciclo",
  SEM_DADOS: "Sem dados",
} as const;

export interface LinhaConta {
  origem: string;
  projetado: number;
}

/** Valor que ainda não foi lançado e entra na conta como estimativa. */
export function ehEstimado(linha: Pick<LinhaConta, "origem">): boolean {
  return linha.origem === "MEDIA" || linha.origem === "RECORRENCIA" || linha.origem === "RITMO";
}

/** Os dois meses lado a lado: o anterior ao central (em geral o último a fechar) e o central (o mês corrente). */
export function mesesDoPainel(central: string): { anterior: string; atual: string } {
  return { anterior: deslocarMes(central, -1), atual: central };
}

export interface MesParaAviso {
  fechado: boolean;
}

/**
 * Lembrete da conferência: a partir do dia combinado, se o mês anterior ainda não foi fechado.
 * Só vale olhando o mês corrente de verdade (`centralEhHoje`).
 */
export function avisoConferencia(
  hojeIso: string, diaConferencia: number, anterior: MesParaAviso | null, competenciaAnterior: string, centralEhHoje: boolean,
): string | null {
  if (!centralEhHoje || !anterior || anterior.fechado) return null;
  const dia = Number(hojeIso.slice(8, 10));
  if (!(dia >= diaConferencia)) return null;
  return `Já passou do dia ${diaConferencia}: confira os valores e feche ${rotuloMes(competenciaAnterior)}.`;
}

/** Frase da folga em relação à meta, para o card do mês. */
export function textoFolga(folga: number, meta: number, formatar: (v: number) => string): string {
  if (folga >= 0) return `${formatar(folga)} acima da meta de ${formatar(meta)}`;
  return `${formatar(-folga)} abaixo da meta de ${formatar(meta)}`;
}

/** "3 lançamentos ainda previstos" / "1 lançamento ainda previsto" (vazio se nenhum). */
export function textoPrevistos(qt: number): string {
  if (qt <= 0) return "";
  return qt === 1 ? "1 lançamento ainda previsto" : `${qt} lançamentos ainda previstos`;
}

// ---------- exportação do fechamento ----------

export interface MesParaPlanilha {
  competencia: string;
  fechado: boolean;
  comSaldoAnterior: boolean;
  saldoAnterior: number | null;
  entradas: { nmCategoria: string; projetado: number; origem: string }[];
  saidas: { nmCategoria: string; projetado: number; origem: string }[];
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  metaSaldo: number | null;
}

/** Linhas da planilha de fechamento (como a original): saldo anterior, entradas, saídas, totais e saldo final. */
export function linhasFechamento(mes: MesParaPlanilha): { Item: string; Tipo: string; Valor: number; Origem: string }[] {
  const origem = (o: string) => (ehEstimado({ origem: o }) ? `Estimado (${ROTULO_ORIGEM[o as keyof typeof ROTULO_ORIGEM] ?? o})` : "Lançado");
  const linhas: { Item: string; Tipo: string; Valor: number; Origem: string }[] = [];
  if (mes.comSaldoAnterior && mes.saldoAnterior !== null) linhas.push({ Item: "Saldo anterior", Tipo: "Entrada", Valor: mes.saldoAnterior, Origem: "Mês anterior" });
  for (const l of mes.entradas) linhas.push({ Item: l.nmCategoria, Tipo: "Entrada", Valor: l.projetado, Origem: origem(l.origem) });
  linhas.push({ Item: "Total de entradas", Tipo: "Total", Valor: mes.totalEntradas, Origem: "" });
  for (const l of mes.saidas) linhas.push({ Item: l.nmCategoria, Tipo: "Saída", Valor: l.projetado, Origem: origem(l.origem) });
  linhas.push({ Item: "Total de saídas", Tipo: "Total", Valor: mes.totalSaidas, Origem: "" });
  linhas.push({ Item: mes.fechado ? "Saldo final" : "Saldo projetado", Tipo: "Saldo", Valor: mes.saldoFinal, Origem: mes.fechado ? "Mês fechado" : "Projeção" });
  if (mes.metaSaldo !== null) linhas.push({ Item: "Meta de saldo", Tipo: "Meta", Valor: mes.metaSaldo, Origem: "" });
  return linhas;
}

// ---------- ciclo e gráfico da fatura ----------

export interface Ciclo {
  /** yyyy-MM-dd: primeiro dia do ciclo */
  inicio: string;
  /** yyyy-MM-dd: dia do fechamento */
  fim: string;
  dias: number;
}

const dois = (n: number) => String(n).padStart(2, "0");

function diaDoMes(competencia: string, dia: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes - 1, Math.max(1, Math.min(dia, ultimo))));
}

const iso = (d: Date) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
const DIA_MS = 86_400_000;

/** Ciclo da fatura do mês: do dia seguinte ao fechamento do mês anterior até o fechamento do mês (como no backend). */
export function cicloDaFatura(competencia: string, diaFechamento: number): Ciclo {
  const fim = diaDoMes(competencia, diaFechamento);
  const inicio = new Date(diaDoMes(deslocarMes(competencia, -1), diaFechamento).getTime() + DIA_MS);
  return { inicio: iso(inicio), fim: iso(fim), dias: Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1 };
}

/** Dias desde o início do ciclo (0 = primeiro dia). */
export function diaDoCiclo(ciclo: Ciclo, dataIso: string): number {
  const d = Date.parse(`${dataIso}T00:00:00Z`);
  const i = Date.parse(`${ciclo.inicio}T00:00:00Z`);
  return Math.round((d - i) / DIA_MS);
}

/** "08/10" a partir de yyyy-MM-dd. */
export function diaMes(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

/** Escala com 4 divisões de passo "redondo" (1, 1,2, 1,5, 2, 2,5, 3, 4, 5, 6, 8 × 10^k) cobrindo `max`. */
export function escalaBonita(max: number): { topo: number; passo: number } {
  if (!(max > 0)) return { topo: 4, passo: 1 };
  const necessario = max / 4;
  const potencia = Math.pow(10, Math.floor(Math.log10(necessario)));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const passo = f * potencia;
    if (passo >= necessario - 1e-9) return { topo: passo * 4, passo };
  }
  return { topo: 40 * potencia, passo: 10 * potencia };
}

export interface LeituraGrafico {
  dtLeitura: string;
  vlLeitura: number;
}

export interface PontoGrafico {
  x: number;
  y: number;
  /** dd/MM */
  rotulo: string;
  valor: number;
  tipo: "leitura" | "projecao";
}

export interface DadosGrafico {
  pontos: PontoGrafico[];
  /** Ponto da projeção no fim do ciclo (nulo se não há o que projetar). */
  projecao: PontoGrafico | null;
  yTicks: { y: number; valor: number }[];
  xTicks: { x: number; rotulo: string }[];
  topo: number;
}

export interface AreaGrafico {
  largura: number;
  altura: number;
  esquerda: number;
  direita: number;
  superior: number;
  inferior: number;
}

/**
 * Converte as leituras (e a projeção no fechamento) em coordenadas SVG. Leituras fora do ciclo são ignoradas.
 * `projetado` só vira ponto se for maior que a última leitura (senão a fatura já está no valor final).
 */
export function dadosDoGrafico(leituras: LeituraGrafico[], ciclo: Ciclo, projetado: number | null, area: AreaGrafico): DadosGrafico {
  const utilX = area.largura - area.esquerda - area.direita;
  const utilY = area.altura - area.superior - area.inferior;
  const ultimoDia = Math.max(1, ciclo.dias - 1);

  const validas = leituras
    .map(l => ({ iso: dataBrParaIso(l.dtLeitura) ?? "", valor: l.vlLeitura }))
    .filter(l => l.iso !== "")
    .map(l => ({ ...l, dia: diaDoCiclo(ciclo, l.iso) }))
    .filter(l => l.dia >= 0 && l.dia <= ultimoDia)
    .sort((a, b) => a.dia - b.dia);

  const ultima = validas[validas.length - 1];
  const temProjecao = projetado !== null && ultima !== undefined && projetado > ultima.valor && ultima.dia < ultimoDia;
  const maximo = Math.max(0, ...validas.map(l => l.valor), temProjecao ? (projetado as number) : 0);
  const { topo, passo } = escalaBonita(maximo);

  const x = (dia: number) => area.esquerda + (dia / ultimoDia) * utilX;
  const y = (valor: number) => area.superior + utilY - (valor / topo) * utilY;

  const pontos: PontoGrafico[] = validas.map(l => ({ x: x(l.dia), y: y(l.valor), rotulo: diaMes(l.iso), valor: l.valor, tipo: "leitura" }));
  const projecao: PontoGrafico | null = temProjecao
    ? { x: x(ultimoDia), y: y(projetado as number), rotulo: diaMes(ciclo.fim), valor: projetado as number, tipo: "projecao" }
    : null;

  const yTicks = [0, 1, 2, 3, 4].map(i => ({ y: y(i * passo), valor: i * passo }));
  const meio = Math.round(ultimoDia / 2);
  const dataDoDia = (dia: number) => iso(new Date(Date.parse(`${ciclo.inicio}T00:00:00Z`) + dia * DIA_MS));
  const xTicks = [0, meio, ultimoDia].map(dia => ({ x: x(dia), rotulo: diaMes(dataDoDia(dia)) }));
  return { pontos, projecao, yTicks, xTicks, topo };
}

/** Caminho SVG ("M x y L x y ...") ligando os pontos. */
export function caminho(pontos: { x: number; y: number }[]): string {
  return pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}
