/**
 * Cartas da Virada: regras puras do jogo de descarte por cor ou número (60 passos por segundo), de 2 a 8 na mesa.
 *
 * - Baralho de 108: 4 cores com um 0, dois de cada 1–9, dois Pular, dois Inverter e dois +2; mais 4 Coringas e 4 +4.
 * - Cada um começa com 7 cartas (5 no Rápido). Descarte uma carta da mesma cor, número ou símbolo; o Coringa troca a
 *   cor; o +4 também, e só vale quando você não tem carta da cor da mesa.
 * - Sem jogada, compre uma; se a comprada servir, pode jogá-la na hora.
 * - Ficou com uma carta? Avise "Virada!" (seta para cima) a tempo, ou compra 2.
 * - Pular: o próximo perde a vez. Inverter: muda o sentido (com 2, vale como Pular). +2/+4: o próximo compra e perde a vez.
 * - Empilhamento Caótico: +2 e +4 acumulam (quem não tem +2/+4 compra tudo); o 7 troca a mão com quem tem menos
 *   cartas e o 0 passa todas as mãos no sentido do jogo.
 * - Rápido: 5 cartas e 8 s por vez.
 * - Vence a rodada quem zera a mão; os pontos são as cartas que sobraram com os rivais.
 * - Sozinho: você contra 3 bots.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const CORES = ["r", "g", "b", "y"] as const;
export type Cor = (typeof CORES)[number];
export const NOME_COR: Record<Cor, string> = { r: "vermelho", g: "verde", b: "azul", y: "amarelo" };
export type ModoCartas = "classico" | "caotico" | "rapido";
export const AVISO_PASSOS = 120;
const PAUSA_JOGADA = 26;
const DAS = 14;
const ARR = 6;

/** Carta como texto: cor (r/g/b/y; w = coringa) + valor (0–9, P = Pular, I = Inverter, +2, C = Coringa, +4). */
export type Carta = string;
export const corDe = (c: Carta) => c[0] as Cor | "w";
export const valorDe = (c: Carta) => c.slice(1);
export const ehCoringa = (c: Carta) => c[0] === "w";
export const ehCompra = (c: Carta) => valorDe(c) === "+2" || valorDe(c) === "+4";

export function baralhoCompleto(): Carta[] {
  const b: Carta[] = [];
  for (const cor of CORES) {
    b.push(`${cor}0`);
    for (const v of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "P", "I", "+2"]) b.push(`${cor}${v}`, `${cor}${v}`);
  }
  for (let i = 0; i < 4; i++) b.push("wC", "w+4");
  return b;
}

export function valorEmPontos(c: Carta): number {
  const v = valorDe(c);
  if (/^\d$/.test(v)) return Number(v);
  return ehCoringa(c) ? 50 : 20;
}

export interface JogadorCartas {
  id: number;
  bot: Dificuldade | null;
  /** Bot que só completa a mesa no modo sozinho (não tem vaga). */
  interno: boolean;
  nome: string;
  mao: Carta[];
  sel: number;
  /** Avisou "Virada!" nesta descida para 1 carta. */
  avisou: boolean;
  /** Prazo para avisar (passo); passou sem avisar = compra 2. */
  avisoAte: number | null;
  /** Bot: se vai esquecer de avisar desta vez. */
  vaiEsquecer: boolean;
  dirAnterior: Direcao | null;
  dirDesde: number;
  aAnterior: boolean;
  bAnterior: boolean;
}

export type EventoCartas =
  | { tipo: "vez"; jogador: number }
  | { tipo: "jogou"; jogador: number; carta: Carta }
  | { tipo: "comprou"; jogador: number; n: number }
  | { tipo: "pulou"; jogador: number }
  | { tipo: "inverteu" }
  | { tipo: "cor"; jogador: number; cor: Cor }
  | { tipo: "virada"; jogador: number }
  | { tipo: "esqueceu"; jogador: number }
  | { tipo: "trocou"; jogador: number; com: number }
  | { tipo: "girou" }
  | { tipo: "invalida"; jogador: number }
  | { tipo: "fim"; vencedor: number };

export interface EstadoCartas {
  modo: ModoCartas;
  jogadores: JogadorCartas[];
  monte: Carta[];
  descarte: Carta[];
  corAtual: Cor;
  sentido: 1 | -1;
  vez: number;
  /** +2/+4 acumulados no Empilhamento Caótico. */
  acumulado: number;
  /** "jogar"; "cor" (escolhendo a cor do coringa); "comprada" (pode jogar a carta comprada ou passar). */
  etapa: "jogar" | "cor" | "comprada";
  selCor: number;
  /** Carta comprada que pode ser jogada na etapa "comprada". */
  comprada: Carta | null;
  /** Coringa esperando a cor (fica fora da mão). */
  pendente: Carta | null;
  passo: number;
  inicioVez: number;
  esperaAte: number;
  tempoVez: number;
  sorteio: () => number;
  eventos: EventoCartas[];
  terminado: boolean;
  vencedor: number | null;
}

function embaralhar<T>(l: T[], s: () => number): T[] {
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(s() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

export function novaPartidaCartas(o: { modo: ModoCartas; semente: number; jogadores: { bot: Dificuldade | null; nome?: string }[]; botsSozinho?: Dificuldade }): EstadoCartas {
  const sorteio = rng(o.semente);
  const lista = o.jogadores.map((j, i) => ({ bot: j.bot, interno: false, nome: j.nome ?? `P${i + 1}` }));
  // Sozinho: 3 bots completam a mesa.
  if (lista.length === 1) for (let k = 1; k <= 3; k++) lista.push({ bot: o.botsSozinho ?? "medio", interno: true, nome: `Rival ${k}` });
  const monte = embaralhar(baralhoCompleto(), sorteio);
  const n = o.modo === "rapido" ? 5 : 7;
  const jogadores: JogadorCartas[] = lista.map((j, i) => ({
    id: i, ...j, mao: ordenar(monte.splice(0, n)), sel: 0, avisou: false, avisoAte: null, vaiEsquecer: false,
    dirAnterior: null, dirDesde: 0, aAnterior: false, bAnterior: false,
  }));
  // A primeira carta da mesa é sempre um número.
  let k = monte.findIndex(c => /^\d$/.test(valorDe(c)));
  if (k < 0) k = 0;
  const topo = monte.splice(k, 1)[0];
  const e: EstadoCartas = {
    modo: o.modo, jogadores, monte, descarte: [topo], corAtual: corDe(topo) as Cor, sentido: 1, vez: Math.floor(sorteio() * jogadores.length),
    acumulado: 0, etapa: "jogar", selCor: 0, comprada: null, pendente: null, passo: 0, inicioVez: 0, esperaAte: 0,
    tempoVez: (o.modo === "rapido" ? 8 : 20) * 60, sorteio, eventos: [], terminado: false, vencedor: null,
  };
  comecarVez(e, e.vez);
  return e;
}

const ORDEM_VALOR = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "P", "I", "+2", "C", "+4"];
/** Mão ordenada por cor e valor (coringas no fim). */
export function ordenar(m: Carta[]): Carta[] {
  const oc = (c: Carta) => "rgbyw".indexOf(c[0]);
  return [...m].sort((a, b) => oc(a) - oc(b) || ORDEM_VALOR.indexOf(valorDe(a)) - ORDEM_VALOR.indexOf(valorDe(b)));
}

export const topo = (e: EstadoCartas) => e.descarte[e.descarte.length - 1];

/** Pode jogar esta carta agora? */
export function podeJogar(e: EstadoCartas, j: JogadorCartas, c: Carta): boolean {
  if (e.acumulado > 0) {
    // Empilhamento: só +2 sobre +2 e +4 sobre qualquer compra.
    return valorDe(c) === "+4" || (valorDe(c) === "+2" && valorDe(topo(e)) === "+2");
  }
  if (valorDe(c) === "+4") return !j.mao.some(x => x !== c && corDe(x) === e.corAtual);
  if (ehCoringa(c)) return true;
  return corDe(c) === e.corAtual || valorDe(c) === valorDe(topo(e));
}

export const jogaveis = (e: EstadoCartas, j: JogadorCartas) => j.mao.filter(c => podeJogar(e, j, c));

const proximo = (e: EstadoCartas, de = e.vez, passos = 1) => {
  const n = e.jogadores.length;
  return (((de + e.sentido * passos) % n) + n) % n;
};

function comecarVez(e: EstadoCartas, quem: number) {
  e.vez = quem;
  e.inicioVez = e.passo;
  e.etapa = "jogar";
  e.comprada = null;
  const j = e.jogadores[quem];
  j.sel = Math.min(j.sel, Math.max(0, j.mao.length - 1));
  // Já começa com a mira numa carta que serve, quando houver.
  const ok = j.mao.findIndex(c => podeJogar(e, j, c));
  if (ok >= 0 && !podeJogar(e, j, j.mao[j.sel] ?? "")) j.sel = ok;
  e.eventos.push({ tipo: "vez", jogador: quem });
}

function comprar(e: EstadoCartas, quem: number, n: number): Carta[] {
  const j = e.jogadores[quem];
  const novas: Carta[] = [];
  for (let k = 0; k < n; k++) {
    if (!e.monte.length) {
      // Monte acabou: embaralha o descarte (menos a carta de cima).
      const t = e.descarte.pop()!;
      e.monte = embaralhar([...e.descarte], e.sorteio);
      e.descarte = [t];
      if (!e.monte.length) break;
    }
    novas.push(e.monte.pop()!);
  }
  j.mao = ordenar([...j.mao, ...novas]);
  if (j.mao.length > 1) { j.avisou = false; j.avisoAte = null; }
  if (novas.length) e.eventos.push({ tipo: "comprou", jogador: quem, n: novas.length });
  return novas;
}

function passarVez(e: EstadoCartas, pular = 0) {
  e.esperaAte = e.passo + PAUSA_JOGADA;
  let q = proximo(e);
  for (let k = 0; k < pular; k++) {
    e.eventos.push({ tipo: "pulou", jogador: q });
    q = proximo(e, q);
  }
  comecarVez(e, q);
}

/** Joga a carta {@code c} da mão de quem está na vez; coringas pedem a cor (escolhida já, em {@code cor}, ou na etapa "cor"). */
export function jogar(e: EstadoCartas, quem: number, c: Carta, cor?: Cor): boolean {
  if (e.terminado || quem !== e.vez || e.passo < e.esperaAte) return false;
  const j = e.jogadores[quem];
  if (e.etapa === "cor") return false;
  if (e.etapa === "comprada" && c !== e.comprada) return false;
  const i = j.mao.indexOf(c);
  if (i < 0 || !podeJogar(e, j, c)) { e.eventos.push({ tipo: "invalida", jogador: quem }); return false; }
  j.mao.splice(i, 1);
  j.sel = Math.min(j.sel, Math.max(0, j.mao.length - 1));
  e.eventos.push({ tipo: "jogou", jogador: quem, carta: c });
  if (j.mao.length === 1 && !j.avisou) j.avisoAte = e.passo + AVISO_PASSOS;
  if (ehCoringa(c)) {
    if (cor) { e.descarte.push(c); aplicar(e, c, cor); }
    else { e.pendente = c; e.etapa = "cor"; e.selCor = Math.max(0, CORES.indexOf(corMaisComum(j.mao))); }
    return true;
  }
  e.descarte.push(c);
  aplicar(e, c);
  return true;
}

/** Escolhe a cor do coringa pendente. */
export function escolherCor(e: EstadoCartas, quem: number, cor: Cor) {
  if (e.etapa !== "cor" || quem !== e.vez || !e.pendente) return;
  const c = e.pendente;
  e.pendente = null;
  e.descarte.push(c);
  aplicar(e, c, cor);
}

function aplicar(e: EstadoCartas, c: Carta, cor?: Cor) {
  const quem = e.vez;
  const j = e.jogadores[quem];
  e.corAtual = cor ?? (corDe(c) as Cor);
  if (cor) e.eventos.push({ tipo: "cor", jogador: quem, cor });
  if (!j.mao.length) {
    e.terminado = true;
    e.vencedor = quem;
    e.eventos.push({ tipo: "fim", vencedor: quem });
    return;
  }
  const v = valorDe(c);
  if (e.modo === "caotico" && v === "7") trocarComMenor(e, quem);
  if (e.modo === "caotico" && v === "0") girarMaos(e);
  if (v === "P") return passarVez(e, 1);
  if (v === "I") {
    e.sentido = e.sentido === 1 ? -1 : 1;
    e.eventos.push({ tipo: "inverteu" });
    return passarVez(e, e.jogadores.length === 2 ? 1 : 0);
  }
  if (v === "+2" || v === "+4") {
    const n = v === "+2" ? 2 : 4;
    if (e.modo === "caotico") { e.acumulado += n; return passarVez(e); }
    const alvo = proximo(e);
    comprar(e, alvo, n);
    return passarVez(e, 1);
  }
  passarVez(e);
}

function trocarComMenor(e: EstadoCartas, quem: number) {
  const outros = e.jogadores.filter(o => o.id !== quem);
  const menor = outros.reduce((a, b) => (b.mao.length < a.mao.length ? b : a));
  const j = e.jogadores[quem];
  [j.mao, menor.mao] = [menor.mao, j.mao];
  for (const p of [j, menor]) { p.avisou = p.mao.length === 1; p.avisoAte = null; p.sel = 0; }
  e.eventos.push({ tipo: "trocou", jogador: quem, com: menor.id });
}

function girarMaos(e: EstadoCartas) {
  const maos = e.jogadores.map(j => j.mao);
  e.jogadores.forEach((j, i) => {
    j.mao = maos[proximo(e, i, -1)];
    j.avisou = j.mao.length === 1;
    j.avisoAte = null;
    j.sel = 0;
  });
  e.eventos.push({ tipo: "girou" });
}

/** Compra (ou paga o acumulado). Depois de comprar uma, a carta pode ser jogada se servir. */
export function comprarNaVez(e: EstadoCartas, quem: number) {
  if (e.terminado || quem !== e.vez || e.passo < e.esperaAte || e.etapa === "cor") return;
  if (e.etapa === "comprada") { passarVez(e); return; }
  if (e.acumulado > 0) {
    comprar(e, quem, e.acumulado);
    e.acumulado = 0;
    passarVez(e);
    return;
  }
  const [nova] = comprar(e, quem, 1);
  const j = e.jogadores[quem];
  if (nova && podeJogar(e, j, nova)) {
    e.etapa = "comprada";
    e.comprada = nova;
    j.sel = j.mao.indexOf(nova);
  } else passarVez(e);
}

/** "Virada!": avisa a última carta (vale com 2 cartas na mão, antes de jogar, ou logo depois de ficar com 1). */
export function avisar(e: EstadoCartas, quem: number) {
  const j = e.jogadores[quem];
  if (j.mao.length > 2 || j.avisou) return;
  j.avisou = true;
  j.avisoAte = null;
  e.eventos.push({ tipo: "virada", jogador: quem });
}

export function corMaisComum(m: Carta[]): Cor {
  const n: Record<Cor, number> = { r: 0, g: 0, b: 0, y: 0 };
  for (const c of m) if (!ehCoringa(c)) n[corDe(c) as Cor]++;
  return CORES.reduce((a, b) => (n[b] > n[a] ? b : a));
}

/** Pontos da rodada: quem zera a mão leva a soma das cartas dos rivais. */
export function pontosCartas(e: EstadoCartas): number[] {
  const soma = e.jogadores.reduce((s, j) => s + j.mao.reduce((t, c) => t + valorEmPontos(c), 0), 0);
  return e.jogadores.filter(j => !j.interno).map(j => (e.vencedor === j.id ? soma : 0));
}

// ---------------------------------------------------------------- bots

const ATRASO: Record<Dificuldade, number> = { facil: 55, medio: 42, dificil: 32 };
const ESQUECE: Record<Dificuldade, number> = { facil: 0.35, medio: 0.12, dificil: 0.02 };

/** A carta que o bot joga (null = compra). */
export function escolhaDoBot(e: EstadoCartas, j: JogadorCartas): Carta | null {
  const ok = jogaveis(e, j);
  if (e.etapa === "comprada") return e.comprada && ok.includes(e.comprada) ? e.comprada : null;
  if (!ok.length) return null;
  const nivel = j.bot ?? "medio";
  if (nivel === "facil") return ok[Math.floor(e.sorteio() * ok.length)];
  const comuns = ok.filter(c => !ehCoringa(c));
  if (nivel === "medio") {
    if (comuns.length) return comuns.reduce((a, b) => (valorEmPontos(b) > valorEmPontos(a) ? b : a));
    return ok[0];
  }
  // Difícil: castiga quem está quase ganhando, segura coringas, livra-se de cartas pesadas e da cor que mais tem.
  const prox = e.jogadores[proximo(e)];
  if (prox.mao.length <= 2) {
    const ataque = ok.find(c => ["+2", "+4", "P"].includes(valorDe(c))) ?? ok.find(c => valorDe(c) === "I" && e.jogadores.length > 2);
    if (ataque) return ataque;
  }
  if (e.modo === "caotico") {
    const menor = Math.min(...e.jogadores.filter(o => o.id !== j.id).map(o => o.mao.length));
    const sete = ok.find(c => valorDe(c) === "7");
    if (sete && menor < j.mao.length - 2) return sete;
  }
  if (comuns.length) {
    const cor = corMaisComum(j.mao);
    return [...comuns].sort((a, b) => (corDe(b) === cor ? 1 : 0) - (corDe(a) === cor ? 1 : 0) || valorEmPontos(b) - valorEmPontos(a))[0];
  }
  return ok[0];
}

// ---------------------------------------------------------------- passo

function moverSel(e: EstadoCartas, j: JogadorCartas, d: Direcao) {
  if (d === "cima") { avisar(e, j.id); return; }
  if (e.etapa === "cor" && e.vez === j.id) {
    if (d === "esquerda") e.selCor = (e.selCor + 3) % 4;
    else if (d === "direita") e.selCor = (e.selCor + 1) % 4;
    return;
  }
  if (!j.mao.length) return;
  if (d === "esquerda") j.sel = (j.sel - 1 + j.mao.length) % j.mao.length;
  else if (d === "direita") j.sel = (j.sel + 1) % j.mao.length;
}

/** Um passo (1/60 s). Setas ←/→ escolhem a carta (ou a cor), ↑ avisa "Virada!", A joga, B compra/passa. */
export function passoCartas(e: EstadoCartas, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  // Prazo do aviso: quem ficou com 1 carta e não avisou compra 2.
  for (const j of e.jogadores) {
    if (j.avisoAte !== null && e.passo >= j.avisoAte) {
      j.avisoAte = null;
      if (j.mao.length === 1 && !j.avisou) { e.eventos.push({ tipo: "esqueceu", jogador: j.id }); comprar(e, j.id, 2); }
    }
  }
  // Pessoas: setas e botões (o aviso vale fora da vez também).
  for (const j of e.jogadores) {
    if (j.bot) continue;
    const ent = entradas[j.id] ?? { direcao: null, a: false, b: false };
    if (ent.direcao) {
      if (ent.direcao !== j.dirAnterior) { moverSel(e, j, ent.direcao); j.dirDesde = e.passo; }
      else if (ent.direcao !== "cima" && e.passo - j.dirDesde >= DAS && (e.passo - j.dirDesde - DAS) % ARR === 0) moverSel(e, j, ent.direcao);
    }
    j.dirAnterior = ent.direcao;
    const a = ent.a && !j.aAnterior, b = ent.b && !j.bAnterior;
    j.aAnterior = ent.a;
    j.bAnterior = ent.b;
    if (j.id !== e.vez || e.passo < e.esperaAte) continue;
    if (e.etapa === "cor") { if (a) escolherCor(e, j.id, CORES[e.selCor]); continue; }
    if (a && j.mao[j.sel]) jogar(e, j.id, j.mao[j.sel]);
    else if (b) comprarNaVez(e, j.id);
  }
  if (e.terminado || e.passo < e.esperaAte) return;
  const j = e.jogadores[e.vez];
  if (j.bot) {
    const espera = ATRASO[j.bot] + (e.modo === "rapido" ? -10 : 0);
    if (e.passo - e.inicioVez < espera) return;
    if (e.etapa === "cor") { escolherCor(e, j.id, corMaisComum(j.mao)); return; }
    const c = escolhaDoBot(e, j);
    if (!c) { comprarNaVez(e, j.id); return; }
    // Avisa (ou esquece) ao descer para 1 carta.
    if (j.mao.length === 2) {
      j.vaiEsquecer = e.sorteio() < ESQUECE[j.bot];
      if (!j.vaiEsquecer) avisar(e, j.id);
    }
    jogar(e, j.id, c, ehCoringa(c) ? corMaisComum(j.mao.filter(x => x !== c)) : undefined);
    return;
  }
  // Tempo da vez estourou: escolhe a cor mais comum, ou compra/passa.
  if (e.passo - e.inicioVez >= e.tempoVez) {
    if (e.etapa === "cor") escolherCor(e, j.id, corMaisComum(j.mao));
    else comprarNaVez(e, j.id);
    if (e.etapa === "comprada") comprarNaVez(e, j.id);
  }
}
