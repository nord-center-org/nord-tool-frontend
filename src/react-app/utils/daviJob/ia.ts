/** Comportamento dos gatinhos e dos ratos controlados pelo computador (puro, com sorteio injetado). */
import type { Corpo, Entrada, Plataforma } from "./motor.ts";

export type ModoGato = "parar" | "andar" | "pular" | "perseguir" | "brincar" | "comer" | "dormir";

export interface EstadoIA {
  modo: ModoGato;
  ate: number;
  alvoX?: number;
  alvoPlat?: string;
  alvo?: { x: number; y: number };
  /** O que está fazendo no modo brincar (anima o gato). */
  acao?: "arranhar" | "patada";
}

export interface Interesse { x: number; y: number; tipo: "arranhar" | "comer" | "dormir" }

export interface ContextoIA {
  plats: Plataforma[];
  agora: number;
  sorteio: () => number;
  /** Bolinha em movimento ou rato por perto (o gato corre atrás). */
  presa?: { x: number; y: number } | null;
  interesses: Interesse[];
}

const NADA: Entrada = { dir: 0, pular: false, descer: false };
const sinal = (v: number, zona = 3) => (v > zona ? 1 : v < -zona ? -1 : 0);

/** Puleiros alcançáveis a partir do corpo (até ~38 px acima, até 110 px abaixo, perto na horizontal). */
export function alcancaveis(c: Corpo, plats: Plataforma[], alcance = 70, subida = 38): Plataforma[] {
  return plats.filter(p => {
    if (p.id === c.plataforma || p.tipo === "degrau" || p.tipo === "ponte") return false;
    const dy = c.y - p.y;
    if (dy > subida || dy < -110) return false;
    const dx = c.x < p.x ? p.x - c.x : c.x > p.x + p.w ? c.x - (p.x + p.w) : 0;
    return dx <= alcance;
  });
}

/** Andar até um puleiro e pular (ou descer) para ele; no ar, segue para o meio dele. */
function irPara(c: Corpo, alvo: Plataforma): Entrada {
  const meio = alvo.x + alvo.w / 2;
  const acima = alvo.y < c.y - 2;
  if (!c.noChao) return { dir: sinal(meio - c.x, 2), pular: false, descer: false };
  if (acima) {
    const perto = Math.max(alvo.x - 10, Math.min(alvo.x + alvo.w + 10, c.x));
    const dist = perto - c.x;
    if (Math.abs(dist) < 34) return { dir: sinal(meio - c.x, 1), pular: true, descer: false };
    return { dir: sinal(dist), pular: false, descer: false };
  }
  // Abaixo: se já está em cima dele, desce; senão anda até a beirada e cai.
  if (c.x >= alvo.x && c.x <= alvo.x + alvo.w) return { dir: 0, pular: false, descer: true };
  return { dir: sinal(meio - c.x), pular: false, descer: false };
}

export function decidirGato(c: Corpo, ia: EstadoIA, ctx: ContextoIA): { entrada: Entrada; ia: EstadoIA } {
  const { agora, sorteio } = ctx;
  // Presa à vista: corre atrás (de vez em quando, para não serem todos ao mesmo tempo).
  if (ctx.presa && ia.modo !== "perseguir" && ia.modo !== "dormir" && Math.hypot(ctx.presa.x - c.x, ctx.presa.y - c.y) < 170 && sorteio() < 0.05) {
    ia = { modo: "perseguir", ate: agora + 3 + sorteio() * 3, alvo: ctx.presa };
  }
  if (ia.modo === "perseguir" && ctx.presa) ia = { ...ia, alvo: ctx.presa };

  if (agora >= ia.ate) ia = proximoModo(c, ctx);

  switch (ia.modo) {
    case "perseguir": {
      const a = ia.alvo;
      if (!a) return { entrada: NADA, ia: { modo: "parar", ate: agora + 1 } };
      const dx = a.x - c.x, dy = a.y - c.y;
      const pular = c.noChao && dy < -16 && Math.abs(dx) < 46;
      const descer = c.noChao && dy > 22 && Math.abs(dx) < 30 && c.plataforma !== "chao";
      return { entrada: { dir: sinal(dx, 4), pular, descer }, ia };
    }
    case "andar": {
      const dx = (ia.alvoX ?? c.x) - c.x;
      if (Math.abs(dx) < 3) return { entrada: NADA, ia: { modo: "parar", ate: agora + 0.6 + sorteio() * 2 } };
      return { entrada: { dir: sinal(dx, 1) * 0.6, pular: false, descer: false }, ia };
    }
    case "pular": {
      const alvo = ctx.plats.find(p => p.id === ia.alvoPlat);
      if (!alvo || (c.noChao && c.plataforma === alvo.id)) return { entrada: NADA, ia: { modo: "parar", ate: agora + 0.8 + sorteio() * 1.5 } };
      return { entrada: irPara(c, alvo), ia };
    }
    default:
      return { entrada: NADA, ia };
  }
}

function proximoModo(c: Corpo, ctx: ContextoIA): EstadoIA {
  const { agora, sorteio, plats } = ctx;
  const r = sorteio();
  const atual = plats.find(p => p.id === c.plataforma);
  const interesse = ctx.interesses.find(i => Math.abs(i.x - c.x) < 14 && Math.abs(i.y - c.y) < 4);
  if (interesse && r < 0.35) {
    const modo: ModoGato = interesse.tipo === "comer" ? "comer" : interesse.tipo === "dormir" ? "dormir" : "brincar";
    return { modo, ate: agora + (modo === "dormir" ? 6 + sorteio() * 6 : 2 + sorteio() * 2), acao: interesse.tipo === "arranhar" ? "arranhar" : undefined };
  }
  if (r < 0.5 && atual) {
    return { modo: "andar", ate: agora + 5, alvoX: atual.x + 6 + sorteio() * Math.max(1, atual.w - 12) };
  }
  if (r < 0.88) {
    const opcoes = alcancaveis(c, plats);
    if (opcoes.length) return { modo: "pular", ate: agora + 4, alvoPlat: opcoes[Math.floor(sorteio() * opcoes.length)].id };
  }
  return { modo: "parar", ate: agora + 1 + sorteio() * 2.5 };
}

export interface EstadoRato { ate: number; alvoPlat?: string; alvoX?: number }

/**
 * Rato foge do gato mais perto: corre para o outro lado e, quando o gato chega perto ou a beirada acaba,
 * pula para o puleiro alcançável mais longe dele (pique-pega). Sem ameaça, passeia.
 */
export function decidirRato(r: Corpo, estado: EstadoRato, gatos: { x: number; y: number }[], plats: Plataforma[], agora: number, sorteio: () => number,
  alcance = 80): { entrada: Entrada; estado: EstadoRato } {
  const perigo = gatos.map(g => ({ g, d: Math.hypot(g.x - r.x, g.y - r.y) })).sort((a, b) => a.d - b.d)[0];
  const atual = plats.find(p => p.id === r.plataforma);
  const ameacado = perigo && perigo.d < 120;
  if (estado.alvoPlat && agora < estado.ate) {
    const alvo = plats.find(p => p.id === estado.alvoPlat);
    if (alvo && !(r.noChao && r.plataforma === alvo.id)) return { entrada: irPara(r, alvo), estado };
    estado = { ate: 0 };
  }
  if (ameacado) {
    const fugir = r.x < perigo.g.x ? -1 : 1;
    const naBeirada = atual && (fugir < 0 ? r.x - atual.x < 10 : atual.x + atual.w - r.x < 10);
    if (r.noChao && (naBeirada || perigo.d < 46 || sorteio() < 0.02)) {
      const opcoes = alcancaveis(r, plats, alcance, 44)
        .map(p => ({ p, d: Math.hypot(p.x + p.w / 2 - perigo.g.x, p.y - perigo.g.y) }))
        .sort((a, b) => b.d - a.d);
      if (opcoes.length) {
        const escolha = opcoes[Math.min(opcoes.length - 1, Math.floor(sorteio() * Math.min(2, opcoes.length)))].p;
        return { entrada: irPara(r, escolha), estado: { ate: agora + 2.5, alvoPlat: escolha.id } };
      }
    }
    return { entrada: { dir: fugir, pular: false, descer: false }, estado };
  }
  if (agora >= estado.ate || estado.alvoX === undefined) {
    // De vez em quando muda de puleiro (para cima ou para baixo) mesmo sem gato por perto.
    if (r.noChao && sorteio() < 0.35) {
      const opcoes = alcancaveis(r, plats, alcance, 44);
      if (opcoes.length) {
        const escolha = opcoes[Math.floor(sorteio() * opcoes.length)];
        return { entrada: irPara(r, escolha), estado: { ate: agora + 3, alvoPlat: escolha.id } };
      }
    }
    estado = { ate: agora + 1 + sorteio() * 2, alvoX: atual ? atual.x + 4 + sorteio() * Math.max(1, atual.w - 8) : r.x };
  }
  const dx = (estado.alvoX ?? r.x) - r.x;
  return { entrada: { dir: Math.abs(dx) < 3 ? 0 : (dx > 0 ? 0.5 : -0.5), pular: false, descer: false }, estado };
}

/** Onde um rato novo (ou que voltou) aparece: um lugar sorteado longe dos gatos, em qualquer andar. */
export function lugarParaRato<T extends { x: number; y: number }>(lugares: T[], gatos: { x: number; y: number }[], sorteio: () => number, longe = 80): T {
  const folga = (l: T) => Math.min(Infinity, ...gatos.map(g => Math.hypot(g.x - l.x, g.y - l.y)));
  const livres = lugares.filter(l => folga(l) >= longe);
  // Sem lugar livre (gatos espalhados por tudo): sorteia entre os mais afastados.
  const opcoes = livres.length ? livres : [...lugares].sort((a, b) => folga(b) - folga(a)).slice(0, Math.min(4, lugares.length));
  return opcoes[Math.min(opcoes.length - 1, Math.floor(sorteio() * opcoes.length))];
}

/** Distância mínima entre dois gatos lado a lado no mesmo puleiro. */
export const ESPACO_GATO = 16;

/**
 * Afasta gatos que estão um em cima do outro no mesmo puleiro (cada um vai metade para o seu lado).
 * O gato do jogador (`livre`) não é empurrado nem empurra: só ele pode ficar sobreposto.
 * Não tira ninguém do puleiro: se um lado bate na beirada, o outro anda o resto.
 */
export function separarGatos<T extends { x: number; y: number; noChao: boolean; plataforma: string | null }>(
  corpos: T[], plats: Plataforma[], livre: number, espaco = ESPACO_GATO,
): T[] {
  const novos = corpos.map(c => ({ ...c }));
  for (let volta = 0; volta < 3; volta++) {
    for (let i = 0; i < novos.length; i++) for (let j = i + 1; j < novos.length; j++) {
      if (i === livre || j === livre) continue;
      const a = novos[i], b = novos[j];
      // Degraus de uma escada e tábuas de uma ponte contam como o mesmo puleiro.
      const grupo = (id: string | null) => (id ?? "").split("-")[0];
      if (!a.noChao || !b.noChao || grupo(a.plataforma) !== grupo(b.plataforma) || Math.abs(a.y - b.y) > 12) continue;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= espaco) continue;
      const partes = plats.filter(pl => grupo(pl.id) === grupo(a.plataforma));
      const min = partes.length ? Math.min(...partes.map(pl => pl.x)) + 2 : 0;
      const max = partes.length ? Math.max(...partes.map(pl => pl.x + pl.w)) - 2 : Infinity;
      const dir = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
      const falta = espaco - Math.abs(dx);
      const prender = (v: number) => Math.max(min, Math.min(max, v));
      let ax = prender(a.x - dir * falta / 2), bx = prender(b.x + dir * falta / 2);
      // Quem bateu na beirada fica; o outro anda o resto.
      if ((bx - ax) * dir < espaco) {
        if (ax !== a.x - dir * falta / 2) bx = prender(ax + dir * espaco);
        else ax = prender(bx - dir * espaco);
      }
      a.x = ax;
      b.x = bx;
    }
  }
  return novos;
}
