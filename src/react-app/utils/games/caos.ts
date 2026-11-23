/**
 * Caos Urbano: regras puras (60 passos por segundo), de 1 a 8 carros numa cidade em grade (o motor desenha em 3D).
 *
 * - O carro acelera sozinho; ↓ freia e dá ré, ←/→ vira. A segurado é o nitro (gasta a barra, que recarrega devagar). B é o freio de
 *   mão: o carro derrapa (vira mais e perde velocidade, deixando marca no asfalto).
 * - Prédios são sólidos (o carro bate e volta); praças são abertas.
 * - Fuga Policial: a polícia persegue; a cada 30 s sobe uma estrela de procurado e chegam mais viaturas. Parado com
 *   viatura colada por 2,5 s, é preso. Pontos por tempo livre; sozinho, fique livre por 2 min.
 * - Entrega Expressa: pegue a encomenda (passando por cima) e leve até o destino dela; quanto mais rápido, mais pontos.
 *   3 min; sozinho, 6 entregas.
 * - Derby de Demolição: na praça central, batidas tiram lataria (quem bate mais rápido leva menos dano). Fica o
 *   último carro inteiro; sozinho, destrua as 6 sucatas em 2 min.
 * - Corrida de Rua: 8 postos de controle em sequência pelas ruas; quem completar primeiro vence. Sozinho, contra o relógio.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export type ModoCaos = "fuga" | "entregas" | "derby" | "corrida";
export type CidadeCaos = "centro" | "porto" | "noite";

export const QUADRAS = 7;
export const PASSO_QUADRA = 22;
export const RUA = 10;
export const TAMANHO = QUADRAS * PASSO_QUADRA;
export const VEL_MAX = 0.42;
export const RAIO_DERBY = 30;
export const TEMPO = 180 * 60;
export const TEMPO_FUGA_SOLO = 120 * 60;
export const TEMPO_DERBY_SOLO = 120 * 60;
export const ENTREGAS_SOLO = 6;
export const POSTOS = 8;
const RAIO_CARRO = 1;
const LATARIA = 100;

export interface Predio { x0: number; z0: number; x1: number; z1: number; altura: number }
export interface Carro {
  id: number;
  bot: Dificuldade | null;
  /** "jogador", "policia" ou "sucata" (estas duas são da cidade, não são vagas). */
  papel: "jogador" | "policia" | "sucata";
  x: number; z: number; ang: number; vel: number;
  nitro: number; derrapando: boolean;
  lataria: number; fora: boolean;
  pontos: number; entregas: number; posto: number; tempo: number | null;
  carga: number | null; presoPor: number;
  /** Bot: há quantos passos não sai do lugar, e até quando dá ré para desencostar. */
  travado: number; reAte: number;
  /** Bot: para que cruzamento a rota atual foi traçada. */
  rotaPara: string;
  rota: { x: number; z: number }[];
}
export interface Encomenda { id: number; x: number; z: number; dx: number; dz: number; desde: number; com: number | null }

export type EventoCaos =
  | { tipo: "batida"; x: number; z: number; forca: number }
  | { tipo: "dano"; jogador: number; lataria: number }
  | { tipo: "destruido"; jogador: number; x: number; z: number }
  | { tipo: "preso"; jogador: number }
  | { tipo: "estrela"; nivel: number }
  | { tipo: "pegou"; jogador: number }
  | { tipo: "entregou"; jogador: number; pontos: number }
  | { tipo: "posto"; jogador: number; posto: number }
  | { tipo: "chegou"; jogador: number; posicao: number }
  | { tipo: "nitro"; jogador: number }
  | { tipo: "fim" };

export interface EstadoCaos {
  modo: ModoCaos;
  cidade: CidadeCaos;
  predios: Predio[];
  pracas: boolean[];
  carros: Carro[];
  cidadaos: Carro[];
  encomendas: Encomenda[];
  postos: { x: number; z: number }[];
  estrelas: number;
  chegados: number;
  fimEm: number | null;
  meta: number;
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoCaos[];
  terminado: boolean;
  vencedor: number | null;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const centro = { x: (QUADRAS * PASSO_QUADRA) / 2, z: (QUADRAS * PASSO_QUADRA) / 2 };
/** Cruzamento (i, j) da grade de ruas. */
export const cruzamento = (i: number, j: number) => ({ x: i * PASSO_QUADRA, z: j * PASSO_QUADRA });
const cruzamentoMaisPerto = (p: { x: number; z: number }) => ({
  i: Math.max(0, Math.min(QUADRAS, Math.round(p.x / PASSO_QUADRA))), j: Math.max(0, Math.min(QUADRAS, Math.round(p.z / PASSO_QUADRA))),
});

export function novaPartidaCaos(o: { modo: ModoCaos; cidade: CidadeCaos; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoCaos {
  const sorteio = rng(o.semente);
  const pracas: boolean[] = [];
  const predios: Predio[] = [];
  const meio = (QUADRAS - 1) / 2;
  for (let j = 0; j < QUADRAS; j++) for (let i = 0; i < QUADRAS; i++) {
    // No derby as quadras do meio viram a praça da arena; nas outras, uma em cada cinco é praça.
    const praca = (o.modo === "derby" && Math.abs(i - meio) <= 1.5 && Math.abs(j - meio) <= 1.5) || sorteio() < 0.18;
    pracas.push(praca);
    if (praca) continue;
    const x0 = i * PASSO_QUADRA + RUA / 2, z0 = j * PASSO_QUADRA + RUA / 2, lado = PASSO_QUADRA - RUA;
    // Quadra com 1 ou 2 prédios.
    if (sorteio() < 0.5) predios.push({ x0, z0, x1: x0 + lado, z1: z0 + lado, altura: 6 + sorteio() * 22 });
    else {
      const corte = lado * (0.4 + sorteio() * 0.2);
      predios.push({ x0, z0, x1: x0 + corte - 1, z1: z0 + lado, altura: 6 + sorteio() * 22 });
      predios.push({ x0: x0 + corte + 1, z0, x1: x0 + lado, z1: z0 + lado, altura: 6 + sorteio() * 22 });
    }
  }
  const n = o.jogadores.length;
  const carros: Carro[] = o.jogadores.map((j, k) => {
    let p: { x: number; z: number }, ang: number;
    if (o.modo === "derby") { const a = (k / n) * Math.PI * 2; p = { x: centro.x + Math.cos(a) * RAIO_DERBY * 0.7, z: centro.z + Math.sin(a) * RAIO_DERBY * 0.7 }; ang = a + Math.PI; }
    else { const c = cruzamento(1 + (k % 4) * 2 - (k >= 4 ? 1 : 0), k >= 4 ? 6 : 1); p = { x: c.x, z: c.z }; ang = Math.PI / 2; }
    return novoCarro(k, j.bot, "jogador", p.x, p.z, ang);
  });
  const e: EstadoCaos = {
    modo: o.modo, cidade: o.cidade, predios, pracas, carros, cidadaos: [], encomendas: [], postos: [], estrelas: 1, chegados: 0, fimEm: null,
    meta: TEMPO, passo: 0, proximoId: 100, sorteio, eventos: [], terminado: false, vencedor: null,
  };
  if (o.modo === "fuga") { e.meta = n === 1 ? TEMPO_FUGA_SOLO : TEMPO; chamarPolicia(e); }
  if (o.modo === "entregas") for (let k = 0; k < Math.max(2, n + 1); k++) novaEncomenda(e);
  if (o.modo === "derby" && n === 1) {
    e.meta = TEMPO_DERBY_SOLO;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; const s = novoCarro(e.proximoId++, "facil", "sucata", centro.x + Math.cos(a) * 14, centro.z + Math.sin(a) * 14, a); s.lataria = 35; e.cidadaos.push(s); }
  }
  if (o.modo === "corrida") {
    let anterior = cruzamentoMaisPerto(carros[0]);
    for (let k = 0; k < POSTOS; k++) {
      let c: { i: number; j: number };
      do { c = { i: Math.floor(sorteio() * (QUADRAS + 1)), j: Math.floor(sorteio() * (QUADRAS + 1)) }; } while (Math.abs(c.i - anterior.i) + Math.abs(c.j - anterior.j) < 3);
      e.postos.push(cruzamento(c.i, c.j));
      anterior = c;
    }
    let total = dist(carros[0], e.postos[0]);
    for (let k = 1; k < POSTOS; k++) total += Math.abs(e.postos[k].x - e.postos[k - 1].x) + Math.abs(e.postos[k].z - e.postos[k - 1].z);
    e.meta = n === 1 ? Math.round(total / (VEL_MAX * 0.36)) : TEMPO;
  }
  return e;
}

function novoCarro(id: number, bot: Dificuldade | null, papel: Carro["papel"], x: number, z: number, ang: number): Carro {
  return { id, bot, papel, x, z, ang, vel: 0, nitro: 1, derrapando: false, lataria: LATARIA, fora: false, pontos: 0, entregas: 0, posto: 0, tempo: null, carga: null, presoPor: 0, travado: 0, reAte: 0, rota: [], rotaPara: "" };
}

function pontoNaRua(e: EstadoCaos): { x: number; z: number } {
  const i = Math.floor(e.sorteio() * (QUADRAS + 1)), j = Math.floor(e.sorteio() * QUADRAS);
  const t = 0.25 + e.sorteio() * 0.5;
  return e.sorteio() < 0.5 ? { x: i * PASSO_QUADRA, z: (j + t) * PASSO_QUADRA } : { x: (j + t) * PASSO_QUADRA, z: i * PASSO_QUADRA };
}

function novaEncomenda(e: EstadoCaos) {
  const a = pontoNaRua(e);
  let b = pontoNaRua(e);
  for (let k = 0; k < 10 && dist(a, b) < 50; k++) b = pontoNaRua(e);
  e.encomendas.push({ id: e.proximoId++, x: a.x, z: a.z, dx: b.x, dz: b.z, desde: e.passo, com: null });
}

function chamarPolicia(e: EstadoCaos) {
  const queremos = Math.min(10, e.estrelas + Math.max(0, e.carros.length - 1));
  const cantos = [cruzamento(0, 0), cruzamento(QUADRAS, 0), cruzamento(0, QUADRAS), cruzamento(QUADRAS, QUADRAS), cruzamento(QUADRAS / 2 | 0, 0), cruzamento(0, QUADRAS / 2 | 0)];
  while (e.cidadaos.filter(c => c.papel === "policia").length < queremos) {
    const p = cantos[e.cidadaos.length % cantos.length];
    e.cidadaos.push(novoCarro(e.proximoId++, e.estrelas >= 3 ? "dificil" : "medio", "policia", p.x, p.z, 0));
  }
}

/** Empurra o carro para fora dos prédios (e da borda da cidade/arena); devolve a força da batida. */
function colidirCenario(e: EstadoCaos, c: Carro): number {
  let batida = 0;
  const qi = Math.floor(c.x / PASSO_QUADRA), qj = Math.floor(c.z / PASSO_QUADRA);
  for (const p of e.predios) {
    if (Math.abs((p.x0 + p.x1) / 2 - c.x) > PASSO_QUADRA || Math.abs((p.z0 + p.z1) / 2 - c.z) > PASSO_QUADRA) continue;
    const px = Math.max(p.x0, Math.min(c.x, p.x1)), pz = Math.max(p.z0, Math.min(c.z, p.z1));
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d >= RAIO_CARRO) continue;
    if (d < 1e-6) { c.x = p.x0 - RAIO_CARRO; continue; }
    c.x = px + ((c.x - px) / d) * RAIO_CARRO; c.z = pz + ((c.z - pz) / d) * RAIO_CARRO;
    batida = Math.max(batida, Math.abs(c.vel));
  }
  void qi; void qj;
  const lim = QUADRAS * PASSO_QUADRA;
  if (c.x < -RUA / 2 || c.x > lim + RUA / 2 || c.z < -RUA / 2 || c.z > lim + RUA / 2) {
    c.x = Math.max(-RUA / 2, Math.min(lim + RUA / 2, c.x)); c.z = Math.max(-RUA / 2, Math.min(lim + RUA / 2, c.z));
    batida = Math.max(batida, Math.abs(c.vel));
  }
  if (e.modo === "derby" && c.papel !== "policia") {
    const d = dist(c, centro);
    if (d > RAIO_DERBY) { c.x = centro.x + ((c.x - centro.x) / d) * RAIO_DERBY; c.z = centro.z + ((c.z - centro.z) / d) * RAIO_DERBY; batida = Math.max(batida, Math.abs(c.vel)); }
  }
  if (batida > 0) c.vel *= -0.35;
  return batida;
}

function dirigir(e: EstadoCaos, c: Carro, ent: Entrada) {
  if (c.fora) return;
  const nitro = ent.a && c.nitro > 0.02 && ent.direcao !== "baixo";
  c.derrapando = ent.b && Math.abs(c.vel) > VEL_MAX * 0.4;
  if (nitro) { c.nitro = Math.max(0, c.nitro - 1 / 150); if (e.passo % 20 === 0 && c.papel === "jogador") e.eventos.push({ tipo: "nitro", jogador: c.id }); }
  else c.nitro = Math.min(1, c.nitro + 1 / 900);
  const max = VEL_MAX * (nitro ? 1.5 : 1) * (c.papel === "policia" ? [0, 0.8, 0.87, 0.93, 0.98, 1.02][e.estrelas] : 1);
  // Acelera sozinho (a entrada tem uma direção por vez: virar não pode impedir de acelerar); ↓ freia e dá ré.
  if (ent.direcao === "baixo") c.vel = Math.max(-VEL_MAX * 0.4, c.vel - 0.012);
  else c.vel += (max - c.vel) * (nitro ? 0.05 : 0.025);
  if (c.derrapando) c.vel *= 0.985;
  const vira = ent.direcao === "esquerda" ? -1 : ent.direcao === "direita" ? 1 : 0;
  c.ang = angulo(c.ang + vira * (c.derrapando ? 0.09 : 0.06) * Math.min(1, Math.abs(c.vel) / (VEL_MAX * 0.5)) * Math.sign(c.vel || 1));
  c.x += Math.cos(c.ang) * c.vel; c.z += Math.sin(c.ang) * c.vel;
  const b = colidirCenario(e, c);
  if (b > VEL_MAX * 0.4) {
    e.eventos.push({ tipo: "batida", x: c.x, z: c.z, forca: b });
    if (e.modo === "derby" && c.papel !== "policia") ferir(e, c, b * 25);
  }
}

function ferir(e: EstadoCaos, c: Carro, dano: number) {
  if (c.fora || dano < 1) return;
  c.lataria = Math.max(0, c.lataria - dano);
  if (c.papel === "jogador") e.eventos.push({ tipo: "dano", jogador: c.id, lataria: c.lataria });
  if (c.lataria <= 0) {
    c.fora = true; c.vel = 0;
    if (c.papel === "jogador") e.eventos.push({ tipo: "destruido", jogador: c.id, x: c.x, z: c.z });
    else e.eventos.push({ tipo: "batida", x: c.x, z: c.z, forca: 1 });
  }
}

// ---------------------------------------------------------------- navegação dos bots e da polícia

/**
 * Próximo ponto pelas ruas: a rota é um "L" de cruzamento em cruzamento (primeiro no eixo mais longo) até o cruzamento
 * do alvo; de lá, vai direto. Traçada uma vez por alvo e consumida ponto a ponto.
 */
export function proximoPonto(c: Carro, alvo: { x: number; z: number }): { x: number; z: number } {
  const b = cruzamentoMaisPerto(alvo), chave = `${b.i},${b.j}`;
  if (c.rotaPara !== chave) {
    const a = cruzamentoMaisPerto(c);
    const rota: { x: number; z: number }[] = [cruzamento(a.i, a.j)];
    const primeiroI = Math.abs(b.i - a.i) >= Math.abs(b.j - a.j);
    let { i, j } = a;
    const andar = (eixoI: boolean) => {
      while (eixoI ? i !== b.i : j !== b.j) { if (eixoI) i += Math.sign(b.i - i); else j += Math.sign(b.j - j); rota.push(cruzamento(i, j)); }
    };
    andar(primeiroI); andar(!primeiroI);
    c.rota = rota; c.rotaPara = chave;
  }
  while (c.rota.length && dist(c, c.rota[0]) < RUA * 0.45) c.rota.shift();
  // Já na rua do alvo, com o alvo à frente: vai direto.
  return c.rota.length ? c.rota[0] : alvo;
}

const ERRO_BOT: Record<Dificuldade, number> = { facil: 0.25, medio: 0.1, dificil: 0.03 };

function guiar(e: EstadoCaos, c: Carro, alvo: { x: number; z: number }, direto = false): Entrada {
  const nivel = c.bot ?? "medio";
  const p = direto ? alvo : proximoPonto(c, alvo);
  const quer = Math.atan2(p.z - c.z, p.x - c.x) + (e.sorteio() - 0.5) * ERRO_BOT[nivel];
  const dif = angulo(quer - c.ang);
  // Encostado num prédio (não sai do lugar por 1 s): dá ré por meio segundo.
  c.travado = Math.abs(c.vel) < 0.04 ? c.travado + 1 : 0;
  if (c.travado > 60) { c.reAte = e.passo + 35; c.travado = 0; }
  if (e.passo < c.reAte) return { direcao: "baixo", a: false, b: false };
  const curvaFechada = Math.abs(dif) > 0.6;
  const perto = dist(c, p) < 9;
  return {
    direcao: (curvaFechada || (perto && Math.abs(dif) > 0.3)) && c.vel > VEL_MAX * 0.45 ? "baixo" : dif > 0.08 ? "direita" : dif < -0.08 ? "esquerda" : null,
    a: !curvaFechada && Math.abs(dif) < 0.2 && nivel !== "facil" && c.nitro > 0.5 && dist(c, p) > 25,
    b: Math.abs(dif) > 0.6 && c.vel > VEL_MAX * 0.5,
  };
}

export function decisaoDoBot(e: EstadoCaos, c: Carro): Entrada {
  const vivos = e.carros.filter(o => !o.fora && o.id !== c.id);
  if (c.papel === "policia") {
    const alvo = e.carros.filter(o => !o.fora).sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (!alvo) return { direcao: null, a: false, b: false };
    return guiar(e, c, alvo, dist(alvo, c) < 12);
  }
  if (c.papel === "sucata") return e.passo % 240 < 120 ? { direcao: "cima", a: false, b: false } : { direcao: "esquerda", a: false, b: false };
  if (e.modo === "fuga") {
    // Foge da viatura mais perto, pelas ruas.
    const pol = e.cidadaos.filter(p => p.papel === "policia").sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (!pol) return { direcao: "cima", a: false, b: false };
    const fuga = { x: Math.max(0, Math.min(TAMANHO, c.x + (c.x - pol.x) * 3)), z: Math.max(0, Math.min(TAMANHO, c.z + (c.z - pol.z) * 3)) };
    if (dist(fuga, c) < 10) { fuga.x = TAMANHO - c.x; fuga.z = TAMANHO - c.z; }
    return guiar(e, c, fuga);
  }
  if (e.modo === "entregas") {
    const alvo = c.carga !== null
      ? (() => { const k = e.encomendas.find(x => x.id === c.carga)!; return { x: k.dx, z: k.dz }; })()
      : e.encomendas.filter(k => k.com === null).sort((a, b) => dist(a, c) - dist(b, c))[0];
    return alvo ? guiar(e, c, alvo) : { direcao: null, a: false, b: false };
  }
  if (e.modo === "corrida") return c.posto < POSTOS ? guiar(e, c, e.postos[c.posto]) : { direcao: null, a: false, b: false };
  // Derby: mira no carro mais perto (ou sucata) com velocidade.
  const alvos = [...vivos, ...e.cidadaos.filter(s => !s.fora)];
  const alvo = alvos.sort((a, b) => dist(a, c) - dist(b, c))[0];
  return alvo ? guiar(e, c, alvo, true) : { direcao: "cima", a: false, b: false };
}

// ---------------------------------------------------------------- passo

export function passoCaos(e: EstadoCaos, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const c of e.carros) {
    if (c.fora) continue;
    const ent = c.bot || c.tempo !== null ? decisaoDoBot(e, c) : entradas[c.id] ?? { direcao: null, a: false, b: false };
    dirigir(e, c, ent);
  }
  for (const c of e.cidadaos) if (!c.fora) dirigir(e, c, decisaoDoBot(e, c));
  colisoesEntreCarros(e);
  if (e.modo === "fuga") regrasFuga(e);
  else if (e.modo === "entregas") regrasEntregas(e);
  else if (e.modo === "corrida") regrasCorrida(e);
  verificarFim(e);
}

function colisoesEntreCarros(e: EstadoCaos) {
  const todos = [...e.carros, ...e.cidadaos].filter(c => !c.fora);
  for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
    const a = todos[i], b = todos[j];
    const d = dist(a, b);
    if (d <= 0 || d >= RAIO_CARRO * 2) continue;
    const nx = (b.x - a.x) / d, nz = (b.z - a.z) / d, sobra = RAIO_CARRO * 2 - d;
    a.x -= nx * sobra / 2; a.z -= nz * sobra / 2; b.x += nx * sobra / 2; b.z += nz * sobra / 2;
    const va = Math.abs(a.vel), vb = Math.abs(b.vel), forca = va + vb;
    if (forca > VEL_MAX * 0.5 && e.passo % 4 === 0) e.eventos.push({ tipo: "batida", x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, forca });
    if (e.modo === "derby") {
      // Quem bate mais rápido leva menos dano.
      ferir(e, a, forca * 14 * (vb + 0.05) / (va + vb + 0.1));
      ferir(e, b, forca * 14 * (va + 0.05) / (va + vb + 0.1));
    }
    const media = (a.vel + b.vel) / 2;
    a.vel = media * 0.6; b.vel = media * 0.6;
  }
}

function regrasFuga(e: EstadoCaos) {
  const nivel = Math.min(5, 1 + Math.floor(e.passo / (30 * 60)));
  if (nivel !== e.estrelas) { e.estrelas = nivel; e.eventos.push({ tipo: "estrela", nivel }); chamarPolicia(e); }
  for (const c of e.carros) {
    if (c.fora) continue;
    c.pontos += 1 / 6;
    const colada = e.cidadaos.some(p => p.papel === "policia" && dist(p, c) < RAIO_CARRO * 2.4);
    c.presoPor = colada && Math.abs(c.vel) < 0.08 ? c.presoPor + 1 : Math.max(0, c.presoPor - 2);
    if (c.presoPor >= 150) { c.fora = true; c.vel = 0; e.eventos.push({ tipo: "preso", jogador: c.id }); }
  }
}

function regrasEntregas(e: EstadoCaos) {
  for (const c of e.carros) {
    if (c.fora) continue;
    if (c.carga === null) {
      const k = e.encomendas.find(x => x.com === null && dist(x, c) < 2.5);
      if (k) { k.com = c.id; k.desde = e.passo; c.carga = k.id; e.eventos.push({ tipo: "pegou", jogador: c.id }); }
    } else {
      const k = e.encomendas.find(x => x.id === c.carga);
      if (k && dist({ x: k.dx, z: k.dz }, c) < 3) {
        const pontos = Math.max(50, Math.round(300 - (e.passo - k.desde) / 6));
        c.pontos += pontos; c.entregas++; c.carga = null;
        e.encomendas = e.encomendas.filter(x => x !== k);
        e.eventos.push({ tipo: "entregou", jogador: c.id, pontos });
        novaEncomenda(e);
      }
    }
  }
}

function regrasCorrida(e: EstadoCaos) {
  for (const c of e.carros) {
    if (c.fora || c.posto >= POSTOS) continue;
    if (dist(c, e.postos[c.posto]) < 5) {
      c.posto++;
      e.eventos.push({ tipo: "posto", jogador: c.id, posto: c.posto });
      if (c.posto >= POSTOS) {
        c.tempo = e.passo; e.chegados++;
        c.pontos = [10, 8, 6, 5, 4, 3, 2, 1][e.chegados - 1] ?? 0;
        e.eventos.push({ tipo: "chegou", jogador: c.id, posicao: e.chegados });
        if (e.fimEm === null) e.fimEm = e.passo + 20 * 60;
      }
    }
  }
}

function verificarFim(e: EstadoCaos) {
  const n = e.carros.length;
  const vivos = e.carros.filter(c => !c.fora);
  if (e.modo === "corrida") {
    if (n === 1) { const c = e.carros[0]; if (c.tempo !== null) return terminar(e, c.tempo <= e.meta ? 0 : null); if (e.passo > e.meta * 2) return terminar(e, null); return; }
    if (e.carros.every(c => c.tempo !== null) || (e.fimEm !== null && e.passo >= e.fimEm)) {
      const ordem = e.carros.slice().sort((a, b) => (a.tempo ?? Infinity) - (b.tempo ?? Infinity) || b.posto - a.posto);
      return terminar(e, ordem[0].id);
    }
    return;
  }
  if (e.modo === "derby") {
    if (n === 1) {
      if (e.carros[0].fora) return terminar(e, null);
      if (e.cidadaos.every(s => s.fora)) return terminar(e, 0);
      if (e.passo >= e.meta) return terminar(e, null);
      return;
    }
    if (vivos.length <= 1) return terminar(e, vivos.length ? vivos[0].id : null);
    if (e.passo >= e.meta) { const o = vivos.slice().sort((a, b) => b.lataria - a.lataria); return terminar(e, o.length > 1 && o[0].lataria === o[1].lataria ? null : o[0].id); }
    return;
  }
  if (e.modo === "fuga") {
    if (n === 1) { if (e.carros[0].fora) return terminar(e, null); if (e.passo >= e.meta) return terminar(e, 0); return; }
    if (vivos.length === 0 || e.passo >= e.meta) {
      for (const c of vivos) c.pontos += 100;
      const o = e.carros.slice().sort((a, b) => b.pontos - a.pontos);
      return terminar(e, Math.round(o[0].pontos) === Math.round(o[1].pontos) ? null : o[0].id);
    }
    return;
  }
  // Entregas.
  if (n === 1) { if (e.carros[0].entregas >= ENTREGAS_SOLO) return terminar(e, 0); if (e.passo >= e.meta) return terminar(e, null); return; }
  if (e.passo >= e.meta) {
    const o = e.carros.slice().sort((a, b) => b.pontos - a.pontos || b.entregas - a.entregas);
    terminar(e, o[0].pontos === o[1].pontos && o[0].entregas === o[1].entregas ? null : o[0].id);
  }
}

function terminar(e: EstadoCaos, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim" });
}

export const pontosCaos = (e: EstadoCaos) => e.carros.map(c =>
  e.modo === "derby" ? Math.round(c.lataria) + (c.fora ? 0 : 100) : Math.round(c.pontos) + (e.modo === "corrida" && e.carros.length === 1 && c.tempo !== null ? Math.max(0, e.meta - c.tempo) : 0));
