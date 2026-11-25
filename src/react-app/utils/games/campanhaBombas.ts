import { atingir, mapaDePerigo, celula, DIRECOES, idx, largadas, novaPartida, passo, rng, type Estado, type Entrada, type InimigoCampanha } from "./bombas.ts";

export const ETAPAS_CAMPANHA = [
  { nome: "Pátio das faíscas", mundo: "Usina adormecida", bioma: "fabrica", quantidade: 3 },
  { nome: "Esteiras do caos", mundo: "Usina adormecida", bioma: "fabrica", quantidade: 5 },
  { nome: "Sentinela de cobre", mundo: "Usina adormecida", bioma: "fabrica", quantidade: 1 },
  { nome: "Passagem cristalina", mundo: "Serra do inverno", bioma: "gelo", quantidade: 5 },
  { nome: "Galeria congelada", mundo: "Serra do inverno", bioma: "gelo", quantidade: 6 },
  { nome: "Guardião da geada", mundo: "Serra do inverno", bioma: "gelo", quantidade: 1 },
  { nome: "Fendas da fornalha", mundo: "Coração vulcânico", bioma: "vulcao", quantidade: 6 },
  { nome: "Última centelha", mundo: "Coração vulcânico", bioma: "vulcao", quantidade: 8 },
  { nome: "Núcleo rebelde", mundo: "Coração vulcânico", bioma: "vulcao", quantidade: 1 },
] as const;

export function novaCampanha(nomes: string[], ativos: number[], etapa = 0, semente = 42): Estado {
  const e = novaPartida({ modo: "sobrevivencia", bioma: "fabrica", jogadores: nomes.map(nome => ({ nome, bot: null })), semente });
  e.campanha = { etapa: Math.max(0, Math.min(8, Math.floor(etapa))), vidas: 3, pontos: 0, proximaVida: 3000, inimigos: [], saida: { x: 13, y: 11 }, transicaoEm: 0, mortes: [] };
  e.jogadores.forEach(j => { j.participando = ativos.includes(j.id); j.vivo = !!j.participando; j.time = 0; });
  montarEtapa(e); return e;
}
function montarEtapa(e: Estado) {
  const c = e.campanha!, def = ETAPAS_CAMPANHA[c.etapa];
  const mapa = novaPartida({ modo: "sobrevivencia", bioma: def.bioma, jogadores: e.jogadores.map(j => ({ nome: j.nome, bot: null })), semente: 1031 + c.etapa * 3571 });
  e.grade = mapa.grade; e.escondidos = mapa.escondidos; e.largura = mapa.largura; e.altura = mapa.altura; e.bioma = def.bioma;
  e.bombas = []; e.chamas = []; e.itens = []; e.moedas = []; e.passo = 0; e.duracao = 240 * 60; e.morteSubita = null;
  c.saida = { x: e.largura - 2, y: e.altura - 2 }; c.transicaoEm = 0; c.mortes = [];
  const inicios = largadas(e.largura, e.altura);
  e.jogadores.forEach((j, i) => {
    const [x, y] = inicios[i];
    j.x = j.alvoX = x; j.y = j.alvoY = y; j.time = 0; j.vivo = !!j.participando; j.respawnEm = 0; j.invulneravelAte = 180; j.revanche = undefined;
    j.aAnterior = j.bAnterior = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (celula(e, x + dx, y + dy) === "caixa") e.grade[idx(e, x + dx, y + dy)] = "chao";
  });
  e.grade[idx(e, c.saida.x, c.saida.y)] = "chao";
  // Corredores ímpares formam uma região conectada; nenhum inimigo fica isolado por pilares.
  const candidatos = e.grade.flatMap((tipo, i) => {
    const x = i % e.largura, y = Math.floor(i / e.largura);
    return tipo !== "pilar" && (x % 2 === 1 || y % 2 === 1) && e.jogadores.every(j => !j.participando || Math.hypot(j.x - x, j.y - y) >= 4) ? [{ x, y }] : [];
  });
  const r = rng(73 + c.etapa);
  c.inimigos = Array.from({ length: def.quantidade }, (_, i) => {
    const p = candidatos.splice(Math.floor(r() * candidatos.length), 1)[0] ?? c.saida;
    e.grade[idx(e, p.x, p.y)] = "chao";
    const chefe = c.etapa % 3 === 2;
    return { id: i, x: p.x, y: p.y, alvoX: p.x, alvoY: p.y, tipo: chefe ? "chefe" : (["patrulha", "cacador", "saltador", "cauteloso"] as const)[(i + c.etapa) % 4], aspecto: Math.floor(c.etapa / 3), vida: chefe ? 4 + Math.floor(c.etapa / 3) * 2 : 1, protecaoAte: 0, ataqueEm: 150 };
  });
}
export function entrarCampanha(e: Estado, indice: number): boolean {
  const c = e.campanha, j = e.jogadores[indice];
  if (!c || !j || e.terminado || j.vivo || c.vidas < 1 || c.transicaoEm) return false;
  const base = e.jogadores.find(o => o.vivo);
  const livres = e.grade.flatMap((tipo, i) => tipo === "chao" ? [{ x: i % e.largura, y: Math.floor(i / e.largura) }] : []).filter(p => !e.bombas.some(b => !b.voo && b.x === p.x && b.y === p.y) && !e.chamas.some(f => f.x === p.x && f.y === p.y) && c.inimigos.every(o => o.vida <= 0 || Math.hypot(o.x - p.x, o.y - p.y) > 1.5));
  livres.sort((a, b) => Math.hypot(a.x - (base?.x ?? 1), a.y - (base?.y ?? 1)) - Math.hypot(b.x - (base?.x ?? 1), b.y - (base?.y ?? 1)));
  const p = livres[0]; if (!p) return false;
  c.vidas--; c.mortes = c.mortes.filter(i => i !== indice); j.participando = true; j.vivo = true; j.x = j.alvoX = p.x; j.y = j.alvoY = p.y; j.respawnEm = 0; j.invulneravelAte = e.passo + 180;
  j.montaria = undefined; j.bombas = 1; j.fogo = 2; j.velocidade = 3.6; j.escudo = j.chute = j.luva = j.detonador = false; j.maldicao = null; j.aAnterior = j.bAnterior = false;
  e.eventos.push({ tipo: "retorno", jogador: indice, x: p.x, y: p.y }); return true;
}
function avancarInimigo(e: Estado, o: InimigoCampanha) {
  const c = e.campanha!;
  if (Math.hypot(o.alvoX - o.x, o.alvoY - o.y) < 0.001) {
    const rotas = Object.values(DIRECOES).map(([dx, dy]) => ({ x: Math.round(o.x) + dx, y: Math.round(o.y) + dy })).filter(p => celula(e, p.x, p.y) === "chao" && !e.bombas.some(b => !b.voo && b.x === p.x && b.y === p.y));
    const alvo = e.jogadores.filter(j => j.vivo).sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0];
    if (o.tipo !== "patrulha" && alvo) rotas.sort((a, b) => Math.hypot(a.x - alvo.x, a.y - alvo.y) - Math.hypot(b.x - alvo.x, b.y - alvo.y));
    if (o.tipo === "cauteloso") {
      const perigo = mapaDePerigo(e);
      rotas.sort((a, b) => (perigo[idx(e, a.x, a.y)] === Infinity ? -1 : 1) - (perigo[idx(e, b.x, b.y)] === Infinity ? -1 : 1));
    }
    const r = rng(e.passo * 7919 + o.id * 71);
    const p = rotas[o.tipo === "patrulha" ? Math.floor(r() * rotas.length) : 0];
    if (p) { o.alvoX = p.x; o.alvoY = p.y; }
  }
  const distancia = Math.hypot(o.alvoX - o.x, o.alvoY - o.y), v = (o.tipo === "chefe" ? 1.3 : o.tipo === "saltador" ? (e.passo % 100 < 25 ? 0 : 2.7) : o.tipo === "cacador" ? 1.8 : 1.4) / 60;
  if (distancia > 0) { o.x += (o.alvoX - o.x) * Math.min(1, v / distancia); o.y += (o.alvoY - o.y) * Math.min(1, v / distancia); }
  if (o.tipo === "chefe" && e.passo >= o.ataqueEm) {
    if (o.aspecto === 1) e.jogadores.forEach(j => { if (j.vivo && Math.hypot(j.x - o.x, j.y - o.y) < 3) { j.maldicao = "lento"; j.maldicaoAte = e.passo + 90; } });
    o.ataqueEm = e.passo + Math.max(110, 220 - c.etapa * 8);
    // O chefe anuncia o ataque plantando uma bomba de pavio visível e dando tempo de fuga.
    const x = Math.round(o.x), y = Math.round(o.y);
    if (o.aspecto === 2) for (const [dx, dy] of Object.values(DIRECOES)) {
      const bx = x + dx * 2, by = y + dy * 2;
      if (celula(e, bx, by) === "chao" && !e.bombas.some(b => b.x === bx && b.y === by)) e.bombas.push({ id: e.proximoId++, dono: -1, x: bx, y: by, fogo: 1, pavio: 120, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: bx, destinoY: by, origemX: bx, origemY: by });
    }
    if (!e.bombas.some(b => b.x === x && b.y === y)) e.bombas.push({ id: e.proximoId++, dono: -1, x, y, fogo: 2 + Math.floor(c.etapa / 3), pavio: 110, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: x, destinoY: y, origemX: x, origemY: y });
  }
}
export function passoCampanha(e: Estado, entradas: Entrada[]) {
  const c = e.campanha!; if (e.terminado) return e;
  if (c.transicaoEm) {
    e.passo++;
    if (e.passo >= c.transicaoEm) { c.etapa++; c.vidas++; montarEtapa(e); }
    return e;
  }
  passo(e, entradas);
  for (const o of c.inimigos) {
    if (o.vida <= 0) continue;
    avancarInimigo(e, o);
    // Bombas do próprio chefe não lhe causam dano; as dos jogadores, sim.
    if (e.passo >= o.protecaoAte && e.chamas.some(f => f.dono !== -1 && f.x === Math.round(o.x) && f.y === Math.round(o.y))) {
      o.vida--; o.protecaoAte = e.passo + 60;
      e.eventos.push({ tipo: "explosao", x: o.x, y: o.y, tamanho: 1 });
      if (!o.vida) c.pontos += o.tipo === "chefe" ? 1500 : 250;
    }
    if (o.vida > 0) e.jogadores.forEach(j => { if (j.vivo && e.passo >= j.invulneravelAte && Math.hypot(j.x - o.x, j.y - o.y) < 0.55) atingir(e, j); });
  }
  while (c.pontos >= c.proximaVida) { c.vidas++; c.proximaVida += 3000; }
  for (const j of e.jogadores) {
    if (!j.participando || j.vivo) continue;
    if (!c.mortes.includes(j.id)) { c.mortes.push(j.id); j.respawnEm = e.passo + 90; }
    if (j.respawnEm > 0 && e.passo >= j.respawnEm && c.vidas > 0) { entrarCampanha(e, j.id); c.mortes = c.mortes.filter(i => i !== j.id); }
  }
  if (e.passo >= e.duracao || !e.jogadores.some(j => j.vivo) && c.vidas === 0) {
    e.terminado = true; e.vencedor = null; e.timeVencedor = null;
  } else if (c.inimigos.every(o => o.vida <= 0) && e.jogadores.some(j => j.vivo && Math.hypot(j.x - c.saida.x, j.y - c.saida.y) < 0.65)) {
    c.pontos += 500;
    if (c.etapa === ETAPAS_CAMPANHA.length - 1) { e.terminado = true; e.vencedor = e.jogadores.find(j => j.vivo)!.id; e.timeVencedor = 0; }
    else c.transicaoEm = e.passo + 120;
  }
  return e;
}
