/**
 * Repertório v6 — "Criar": o estúdio onde a pessoa monta uma música faixa por faixa (baixo, teclado, violão,
 * sintetizador e bateria) e o instrumento online. Aqui fica só o modelo, puro e testável em node: o projeto, as
 * faixas e as notas (em tempos), a grade, a gravação, o que tocar em cada intervalo e o teclado do computador.
 */

export type Timbre = "baixo" | "teclado" | "violao" | "lead" | "bateria";

export const TIMBRES: Array<{ id: Timbre; nome: string; faixa: [number, number] }> = [
  { id: "baixo", nome: "Baixo", faixa: [23, 55] },
  { id: "teclado", nome: "Teclado", faixa: [48, 84] },
  { id: "violao", nome: "Violão", faixa: [40, 76] },
  { id: "lead", nome: "Sintetizador", faixa: [55, 88] },
  { id: "bateria", nome: "Bateria", faixa: [35, 51] },
];
export const timbre = (id: Timbre) => TIMBRES.find(t => t.id === id) ?? TIMBRES[0];

/** Peças da bateria, na numeração General MIDI (assim a nota guarda a peça). */
export const PECAS_BATERIA: Array<{ midi: number; nome: string; tecla: string }> = [
  { midi: 49, nome: "Prato", tecla: "u" },
  { midi: 46, nome: "Chimbal aberto", tecla: "y" },
  { midi: 42, nome: "Chimbal", tecla: "t" },
  { midi: 48, nome: "Tom", tecla: "r" },
  { midi: 43, nome: "Surdo", tecla: "e" },
  { midi: 39, nome: "Palmas", tecla: "w" },
  { midi: 38, nome: "Caixa", tecla: "s" },
  { midi: 36, nome: "Bumbo", tecla: "a" },
];

export interface NotaEstudio {
  /** Início, em tempos (semínimas) desde o começo da música. */
  inicio: number;
  /** Duração, em tempos. */
  dur: number;
  midi: number;
  /** Força (0–1). */
  vel: number;
}

export interface Faixa {
  id: string;
  nome: string;
  timbre: Timbre;
  volume: number;
  mudo: boolean;
  solo: boolean;
  notas: NotaEstudio[];
  /** v8: variação do timbre (ex.: baixo "slap"); sem ela, a padrão do instrumento. */
  variante?: string;
}

export interface Projeto {
  id: string;
  titulo: string;
  bpm: number;
  /** Compassos de 4 tempos. */
  compassos: number;
  faixas: Faixa[];
  criadoEm: string;
  atualizadoEm: string;
  /** v7: já esteve na conta (se sumir de lá, foi excluída em outro aparelho). */
  sincronizado?: boolean;
}

export const TEMPOS_POR_COMPASSO = 4;
/** A grade divide o tempo em 4 (semicolcheias). */
export const PASSOS_POR_TEMPO = 4;
export const LIMITES = { bpmMin: 40, bpmMax: 240, compassosMax: 64, faixasMax: 12, notasMax: 4000 } as const;

const id = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function novoProjeto(titulo = "Música nova", agora = new Date().toISOString()): Projeto {
  return { id: id("p"), titulo, bpm: 100, compassos: 4, faixas: [], criadoEm: agora, atualizadoEm: agora };
}

export function novaFaixa(t: Timbre, existentes: Faixa[] = []): Faixa {
  const base = timbre(t).nome;
  const iguais = existentes.filter(f => f.timbre === t).length;
  return { id: id("f"), nome: iguais ? `${base} ${iguais + 1}` : base, timbre: t, volume: 0.8, mudo: false, solo: false, notas: [] };
}

export const segundosPorTempo = (bpm: number) => 60 / limitar(bpm, LIMITES.bpmMin, LIMITES.bpmMax);
export const temposDoProjeto = (p: Pick<Projeto, "compassos">) => p.compassos * TEMPOS_POR_COMPASSO;
export const duracaoEmSegundos = (p: Pick<Projeto, "compassos" | "bpm">) => temposDoProjeto(p) * segundosPorTempo(p.bpm);

/** Leva o tempo para a grade mais próxima (`grade` em tempos, ex.: 0,25 = semicolcheia). */
export const quantizar = (tempo: number, grade = 1 / PASSOS_POR_TEMPO) => (grade > 0 ? Math.round(tempo / grade) * grade : tempo);

/** Ordena por início (e altura), para tocar e salvar sempre igual. */
export const ordenar = (notas: NotaEstudio[]) => [...notas].sort((a, b) => a.inicio - b.inicio || a.midi - b.midi);

/**
 * Clique na grade (piano roll ou bateria): se já há uma nota dessa altura começando nesse passo, ou cobrindo ele, ela
 * sai; senão entra uma nota nova com a duração escolhida, cortada no fim da música.
 */
export function alternarNota(notas: NotaEstudio[], midi: number, inicio: number, dur: number, fim: number): NotaEstudio[] {
  const cobre = notas.find(n => n.midi === midi && inicio >= n.inicio - 1e-6 && inicio < n.inicio + n.dur - 1e-6);
  if (cobre) return notas.filter(n => n !== cobre);
  if (inicio < 0 || inicio >= fim) return notas;
  return ordenar([...notas, { inicio, dur: Math.max(1 / PASSOS_POR_TEMPO, Math.min(dur, fim - inicio)), midi, vel: 0.85 }]);
}

/**
 * Notas tocadas ao vivo durante a gravação, juntadas à faixa: quantizadas (se `grade` > 0), cortadas no fim da
 * música, sem duplicar uma nota igual que já esteja no mesmo lugar.
 */
export function juntarGravacao(notas: NotaEstudio[], gravadas: NotaEstudio[], fim: number, grade = 1 / PASSOS_POR_TEMPO): NotaEstudio[] {
  const novas: NotaEstudio[] = [];
  for (const g of gravadas) {
    const inicio = Math.max(0, quantizar(g.inicio, grade));
    if (inicio >= fim) continue;
    const dur = Math.max(grade || 0.05, Math.min(fim - inicio, grade ? Math.max(grade, quantizar(g.dur, grade)) : g.dur));
    const igual = (n: NotaEstudio) => n.midi === g.midi && Math.abs(n.inicio - inicio) < 1e-6;
    if (notas.some(igual) || novas.some(igual)) continue;
    novas.push({ inicio, dur, midi: g.midi, vel: limitar(g.vel, 0.1, 1) });
  }
  return ordenar([...notas, ...novas]).slice(0, LIMITES.notasMax);
}

/** Faixas que soam: com alguma em solo, só as em solo; mudas nunca. */
export function faixasAudiveis(faixas: Faixa[]): Faixa[] {
  const solo = faixas.some(f => f.solo);
  return faixas.filter(f => !f.mudo && (!solo || f.solo));
}

/**
 * Notas que começam em [de, ate) (em tempos), de todas as faixas que soam. Com repetição (`laco`), o intervalo dá a
 * volta no fim da música: a nota volta com o início somado às voltas já dadas.
 */
export function notasNoIntervalo(p: Projeto, de: number, ate: number, laco = false): Array<{ faixa: Faixa; nota: NotaEstudio; tempo: number }> {
  const total = temposDoProjeto(p);
  const r: Array<{ faixa: Faixa; nota: NotaEstudio; tempo: number }> = [];
  if (ate <= de || total <= 0) return r;
  const audiveis = faixasAudiveis(p.faixas);
  const volta0 = laco ? Math.floor(de / total) : 0;
  const voltaN = laco ? Math.floor((ate - 1e-9) / total) : 0;
  for (let v = volta0; v <= voltaN; v++) {
    const base = v * total;
    for (const f of audiveis) {
      for (const n of f.notas) {
        const t = base + n.inicio;
        if (t >= de && t < ate && n.inicio < total) r.push({ faixa: f, nota: n, tempo: t });
      }
    }
  }
  return r.sort((a, b) => a.tempo - b.tempo);
}

/** Muda o número de compassos: notas que ficariam além do fim saem; as que passam do fim são encurtadas. */
export function mudarCompassos(p: Projeto, compassos: number): Projeto {
  const c = limitar(Math.round(compassos), 1, LIMITES.compassosMax);
  const fim = c * TEMPOS_POR_COMPASSO;
  return {
    ...p, compassos: c,
    faixas: p.faixas.map(f => ({ ...f, notas: f.notas.filter(n => n.inicio < fim).map(n => (n.inicio + n.dur > fim ? { ...n, dur: fim - n.inicio } : n)) })),
  };
}

/** Copia os compassos [de, de+qtd) para logo depois deles (o "repetir trecho"), em todas as faixas ou numa só. */
export function duplicarCompassos(p: Projeto, de: number, qtd: number, soFaixa?: string): Projeto {
  const ini = de * TEMPOS_POR_COMPASSO, fimTrecho = (de + qtd) * TEMPOS_POR_COMPASSO, desloc = qtd * TEMPOS_POR_COMPASSO;
  const novoTotal = Math.min(LIMITES.compassosMax, Math.max(p.compassos, de + qtd * 2));
  const fim = novoTotal * TEMPOS_POR_COMPASSO;
  return {
    ...p, compassos: novoTotal,
    faixas: p.faixas.map(f => {
      if (soFaixa && f.id !== soFaixa) return f;
      const copia = f.notas.filter(n => n.inicio >= ini && n.inicio < fimTrecho).map(n => ({ ...n, inicio: n.inicio + desloc }))
        .filter(n => n.inicio < fim && !f.notas.some(o => o.midi === n.midi && Math.abs(o.inicio - n.inicio) < 1e-6));
      return { ...f, notas: ordenar([...f.notas, ...copia]).slice(0, LIMITES.notasMax) };
    }),
  };
}

// ---------------------------------------------------------------- teclado do computador

/**
 * Teclas do computador para tocar: a fileira do meio são as brancas e a de cima as pretas, como num piano (A = Dó,
 * W = Dó#, S = Ré…, K = Dó de cima, O = Dó#, L = Ré). `oitava` é a do Dó da tecla A (MIDI = 12 × (oitava + 1)).
 */
const TECLAS_PIANO = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p", "ç", ";"];
export function notaDaTecla(tecla: string, oitava: number): number | null {
  const i = TECLAS_PIANO.indexOf(tecla.toLowerCase());
  return i < 0 ? null : 12 * (oitava + 1) + i;
}
export function teclaDaNota(midi: number, oitava: number): string | null {
  const i = midi - 12 * (oitava + 1);
  return i >= 0 && i < TECLAS_PIANO.length ? TECLAS_PIANO[i].toUpperCase() : null;
}
export function pecaDaTecla(tecla: string): number | null {
  return PECAS_BATERIA.find(p => p.tecla === tecla.toLowerCase())?.midi ?? null;
}
/** Oitava inicial de cada timbre no teclado do computador. */
export const OITAVA_PADRAO: Record<Timbre, number> = { baixo: 1, teclado: 4, violao: 3, lead: 4, bateria: 2 };

// ---------------------------------------------------------------- leitura segura (do banco do aparelho)

const ehTimbre = (v: unknown): v is Timbre => TIMBRES.some(t => t.id === v);
const num = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);

/** Lê um projeto guardado, descartando o que estiver fora do formato (versões futuras, dado corrompido). */
export function lerProjeto(bruto: unknown): Projeto | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const compassos = limitar(Math.round(num(o.compassos, 4)), 1, LIMITES.compassosMax);
  const fim = compassos * TEMPOS_POR_COMPASSO;
  const faixas: Faixa[] = (Array.isArray(o.faixas) ? o.faixas : []).slice(0, LIMITES.faixasMax).flatMap((fb): Faixa[] => {
    if (!fb || typeof fb !== "object") return [];
    const f = fb as Record<string, unknown>;
    if (typeof f.id !== "string" || !ehTimbre(f.timbre)) return [];
    const notas = (Array.isArray(f.notas) ? f.notas : []).flatMap((nb): NotaEstudio[] => {
      if (!nb || typeof nb !== "object") return [];
      const n = nb as Record<string, unknown>;
      const inicio = num(n.inicio, -1), dur = num(n.dur, 0), midi = Math.round(num(n.midi, -1));
      if (inicio < 0 || inicio >= fim || dur <= 0 || midi < 0 || midi > 127) return [];
      return [{ inicio, dur: Math.min(dur, fim - inicio), midi, vel: limitar(num(n.vel, 0.85), 0.1, 1) }];
    });
    return [{
      id: f.id, nome: typeof f.nome === "string" && f.nome.trim() ? f.nome.slice(0, 40) : timbre(f.timbre).nome, timbre: f.timbre,
      volume: limitar(num(f.volume, 0.8), 0, 1.5), mudo: f.mudo === true, solo: f.solo === true, notas: ordenar(notas).slice(0, LIMITES.notasMax),
      ...(typeof f.variante === "string" && /^[a-z-]{1,20}$/.test(f.variante) ? { variante: f.variante } : {}),
    }];
  });
  const agora = new Date().toISOString();
  return {
    id: o.id, titulo: typeof o.titulo === "string" && o.titulo.trim() ? o.titulo.slice(0, 80) : "Música nova",
    bpm: limitar(Math.round(num(o.bpm, 100)), LIMITES.bpmMin, LIMITES.bpmMax), compassos, faixas,
    criadoEm: typeof o.criadoEm === "string" ? o.criadoEm : agora, atualizadoEm: typeof o.atualizadoEm === "string" ? o.atualizadoEm : agora,
    ...(o.sincronizado === true ? { sincronizado: true } : {}),
  };
}

// ---------------------------------------------------------------- v9: selecionar, copiar, colar e mover notas

/** Identidade de uma nota na faixa (não há duas notas iguais no mesmo lugar). */
export const chaveNota = (n: Pick<NotaEstudio, "inicio" | "midi">) => `${Math.round(n.inicio * 1000)}:${n.midi}`;

/** Notas que encostam no retângulo (tempos [t0, t1), alturas [m0, m1]), em qualquer ordem dos cantos. */
export function notasNoRetangulo(notas: NotaEstudio[], ta: number, tb: number, ma: number, mb: number): Set<string> {
  const t0 = Math.min(ta, tb), t1 = Math.max(ta, tb), m0 = Math.min(ma, mb), m1 = Math.max(ma, mb);
  return new Set(notas.filter(n => n.midi >= m0 && n.midi <= m1 && n.inicio < t1 && n.inicio + n.dur > t0).map(chaveNota));
}

export interface Recorte { notas: NotaEstudio[]; duracao: number }

/** Copia as notas escolhidas, com o início relativo à primeira (para colar em outro lugar ou outra faixa). */
export function copiarNotas(notas: NotaEstudio[], sel: Set<string>): Recorte | null {
  const escolhidas = notas.filter(n => sel.has(chaveNota(n)));
  if (!escolhidas.length) return null;
  const ini = Math.min(...escolhidas.map(n => n.inicio)), fim = Math.max(...escolhidas.map(n => n.inicio + n.dur));
  return { notas: escolhidas.map(n => ({ ...n, inicio: n.inicio - ini })), duracao: fim - ini };
}

/**
 * Cola o recorte a partir de `inicio` (opcionalmente transposto): o que passaria do fim da música é cortado, nota
 * igual no mesmo lugar não duplica. Devolve as notas e a seleção das coladas.
 */
export function colarNotas(notas: NotaEstudio[], recorte: Recorte, inicio: number, fim: number, transpor = 0): { notas: NotaEstudio[]; sel: Set<string> } {
  const novas: NotaEstudio[] = [];
  for (const n of recorte.notas) {
    const ini = n.inicio + inicio, midi = n.midi + transpor;
    if (ini < 0 || ini >= fim || midi < 0 || midi > 127) continue;
    const c: NotaEstudio = { ...n, inicio: ini, midi, dur: Math.min(n.dur, fim - ini) };
    if (notas.some(o => chaveNota(o) === chaveNota(c)) || novas.some(o => chaveNota(o) === chaveNota(c))) continue;
    novas.push(c);
  }
  return { notas: ordenar([...notas, ...novas]).slice(0, LIMITES.notasMax), sel: new Set(novas.map(chaveNota)) };
}

/**
 * Move as notas escolhidas `dt` tempos e `dm` semitons. Se alguma sairia da música (antes do início, depois do fim
 * ou fora de 0–127), nada se move. As que caem em cima de uma igual não escolhida a substituem.
 */
export function moverNotas(notas: NotaEstudio[], sel: Set<string>, dt: number, dm: number, fim: number): { notas: NotaEstudio[]; sel: Set<string> } {
  const escolhidas = notas.filter(n => sel.has(chaveNota(n)));
  if (!escolhidas.length || escolhidas.some(n => n.inicio + dt < -1e-9 || n.inicio + dt >= fim || n.midi + dm < 0 || n.midi + dm > 127)) return { notas, sel };
  const movidas = escolhidas.map(n => ({ ...n, inicio: Math.max(0, n.inicio + dt), midi: n.midi + dm, dur: Math.min(n.dur, fim - (n.inicio + dt)) }));
  const novasChaves = new Set(movidas.map(chaveNota));
  const resto = notas.filter(n => !sel.has(chaveNota(n)) && !novasChaves.has(chaveNota(n)));
  return { notas: ordenar([...resto, ...movidas]), sel: novasChaves };
}

export const apagarNotas = (notas: NotaEstudio[], sel: Set<string>) => notas.filter(n => !sel.has(chaveNota(n)));

/**
 * Clique na grade no modo "pôr": a nota que já está ali sai; senão entra uma de uma semicolcheia (um quadradinho)
 * que se estica até `ate` quando a pessoa arrasta. Devolve as notas e se uma entrou.
 */
export function porNota(notas: NotaEstudio[], midi: number, inicio: number, ate: number, fim: number): { notas: NotaEstudio[]; entrou: boolean } {
  const passo = 1 / PASSOS_POR_TEMPO;
  const cobre = notas.find(n => n.midi === midi && inicio >= n.inicio - 1e-6 && inicio < n.inicio + n.dur - 1e-6);
  if (cobre) return { notas: notas.filter(n => n !== cobre), entrou: false };
  if (inicio < 0 || inicio >= fim) return { notas, entrou: false };
  const dur = Math.max(passo, Math.min(fim - inicio, Math.ceil((Math.max(ate, inicio) - inicio) / passo + 1e-9) * passo || passo));
  return { notas: ordenar([...notas, { inicio, dur, midi, vel: 0.85 }]), entrou: true };
}

/** Estica (ou encurta) a nota que começa em `inicio` até cobrir o passo `ate` (inclusive). */
export function esticarNota(notas: NotaEstudio[], midi: number, inicio: number, ate: number, fim: number): NotaEstudio[] {
  const passo = 1 / PASSOS_POR_TEMPO;
  const dur = Math.max(passo, Math.min(fim - inicio, Math.floor((ate - inicio) / passo + 1e-9) * passo + passo));
  return notas.map(n => (n.midi === midi && Math.abs(n.inicio - inicio) < 1e-6 ? { ...n, dur } : n));
}
