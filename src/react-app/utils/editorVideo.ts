/**
 * Drumcam v5 — editor de vídeo da Galeria: regras puras (sem DOM).
 *
 * Tudo que tem hora (cenas de layout, destaques de áudio, textos) fica no tempo da GRAVAÇÃO ("tempo da fonte"), e os
 * cortes dizem quais trechos da gravação entram no vídeo final e em que ordem ("tempo editado"). Assim, cortar ou
 * aparar um trecho não desloca o solo de guitarra marcado nem a legenda de um verso: eles continuam presos ao que foi
 * gravado. As funções daqui convertem entre os dois tempos, dizem o layout, os ganhos e a transição de cada instante e
 * acham o atraso entre um áudio externo (da mesa) e o áudio da câmera.
 */
import type { Camada, Filtro, Formato } from "./drumcamAoVivo.ts";

// ---------------------------------------------------------------- modelo

/** Um pedaço da gravação que entra no vídeo final (em segundos da gravação). */
export interface Trecho { id: string; inicio: number; fim: number }
export type TipoTransicao = "corte" | "escurecer" | "clarear";
export interface Transicao { tipo: TipoTransicao; duracao: number }
/** Layout das câmeras num intervalo da gravação. */
export interface CenaEdicao { id: string; inicio: number; fim: number; camadas: Camada[] }
/** Destaque de áudio: no intervalo, a câmera sobe `ganhoDb` e as outras descem `abaixarDb` (com rampa nas pontas). */
export interface Destaque { id: string; inicio: number; fim: number; camera: string; ganhoDb: number; abaixarDb: number }
export interface CanalEdicao { ganhoDb: number; mudo: boolean; pan: number }
export interface Melhoria {
  /** Corta o grave abaixo de 80 Hz (ronco, vento, pancada no tripé). */
  tirarRonco: boolean;
  /** Corta o chiado acima de 12 kHz. */
  tirarChiado: boolean;
  /** Compressor que aproxima o volume das partes fracas e fortes. */
  nivelar: boolean;
  /** Equalizador de 3 faixas, em dB (−12 a +12). */
  graves: number; medios: number; agudos: number;
  /** Ganho final, em dB (−12 a +18); um limitador segura o pico em 0 dB. */
  ganhoDb: number;
}
export interface AudioExterno {
  faixaId: string;
  nome: string;
  /** Segundo do áudio externo que toca no segundo 0 da gravação (negativo: o externo começou depois). */
  deslocamento: number;
  ganhoDb: number;
  /** Usa só o áudio externo (as câmeras ficam mudas). */
  substituir: boolean;
  /** Qualidade da sincronia automática (0 a 1), quando houve. */
  confianca?: number;
}
export type EstiloTexto = "legenda" | "titulo" | "livre";
export interface TextoEdicao {
  id: string; inicio: number; fim: number; texto: string; estilo: EstiloTexto;
  /** Centro do texto, em fração da tela. */
  x: number; y: number;
  /** Altura da letra, em fração da altura da tela. */
  tamanho: number;
  cor: string;
  fundo: boolean;
}
export interface CameraEdicao { id: string; nome: string }

export interface ProjetoEdicao {
  versao: 1;
  cameras: CameraEdicao[];
  /** Duração da gravação (segundos). */
  duracao: number;
  formato: Formato;
  cortes: Trecho[];
  /** Transição na ENTRADA de cada trecho (pelo id do trecho). */
  transicoes: Record<string, Transicao>;
  camadasBase: Camada[];
  cenas: CenaEdicao[];
  filtros: Record<string, Filtro>;
  canais: Record<string, CanalEdicao>;
  destaques: Destaque[];
  /** Duração da rampa de entrada e saída dos destaques (segundos). */
  rampa: number;
  melhoria: Melhoria;
  externo: AudioExterno | null;
  textos: TextoEdicao[];
}

export const MELHORIA_NEUTRA: Melhoria = { tirarRonco: false, tirarChiado: false, nivelar: false, graves: 0, medios: 0, agudos: 0, ganhoDb: 0 };
export const CANAL_EDICAO_PADRAO: CanalEdicao = { ganhoDb: 0, mudo: false, pan: 0 };
const MINIMO = 0.1;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const dbParaLinear = (db: number) => 10 ** (db / 20);
export const linearParaDb = (g: number) => (g <= 0 ? -60 : Math.max(-60, 20 * Math.log10(g)));

/** Projeto novo para uma gravação: um trecho só (o vídeo inteiro) e o layout com que foi gravada. */
export function novoProjeto(opcoes: {
  cameras: CameraEdicao[]; duracao: number; formato: Formato; camadas: Camada[];
  filtros?: Record<string, Filtro>; canais?: Record<string, Partial<CanalEdicao>>;
}): ProjetoEdicao {
  const { cameras, duracao, formato, camadas } = opcoes;
  return {
    versao: 1, cameras, duracao: Math.max(MINIMO, duracao), formato,
    cortes: [{ id: "t1", inicio: 0, fim: Math.max(MINIMO, duracao) }],
    transicoes: {},
    camadasBase: camadas,
    cenas: [],
    filtros: { ...(opcoes.filtros ?? {}) },
    canais: Object.fromEntries(cameras.map(c => [c.id, { ...CANAL_EDICAO_PADRAO, ...(opcoes.canais?.[c.id] ?? {}) }])),
    destaques: [],
    rampa: 0.3,
    melhoria: { ...MELHORIA_NEUTRA },
    externo: null,
    textos: [],
  };
}

/** Lê um projeto guardado; o que faltar (projeto de uma versão antiga, campo apagado) volta ao padrão. */
export function lerProjeto(json: unknown, padrao: ProjetoEdicao): ProjetoEdicao {
  if (!json || typeof json !== "object" || (json as { versao?: unknown }).versao !== 1) return padrao;
  const p = json as Partial<ProjetoEdicao>;
  const cortes = Array.isArray(p.cortes) ? p.cortes.filter(t => t && t.fim - t.inicio >= MINIMO / 2) : [];
  return {
    ...padrao,
    ...p,
    cameras: padrao.cameras,
    duracao: padrao.duracao,
    cortes: cortes.length ? cortes : padrao.cortes,
    melhoria: { ...MELHORIA_NEUTRA, ...(p.melhoria ?? {}) },
    canais: { ...padrao.canais, ...(p.canais ?? {}) },
    transicoes: p.transicoes ?? {},
    cenas: p.cenas ?? [],
    destaques: (p.destaques ?? []).filter(d => padrao.cameras.some(c => c.id === d.camera)),
    textos: p.textos ?? [],
    externo: p.externo ?? null,
  } as ProjetoEdicao;
}

// ---------------------------------------------------------------- cortes (tempo editado ↔ tempo da gravação)

export const duracaoEditada = (cortes: Trecho[]) => cortes.reduce((s, t) => s + (t.fim - t.inicio), 0);

/** Em que trecho e em que segundo da gravação cai o segundo `t` do vídeo editado. */
export function paraFonte(cortes: Trecho[], t: number): { indice: number; tFonte: number } | null {
  if (!cortes.length) return null;
  let acc = 0;
  for (let i = 0; i < cortes.length; i++) {
    const d = cortes[i].fim - cortes[i].inicio;
    if (t < acc + d || i === cortes.length - 1) return { indice: i, tFonte: cortes[i].inicio + limitar(t - acc, 0, d) };
    acc += d;
  }
  return null;
}

/** Onde o segundo `tFonte` da gravação aparece no vídeo editado (null se foi cortado). */
export function paraEditado(cortes: Trecho[], tFonte: number): number | null {
  let acc = 0;
  for (const t of cortes) {
    if (tFonte >= t.inicio && tFonte <= t.fim) return acc + (tFonte - t.inicio);
    acc += t.fim - t.inicio;
  }
  return null;
}

/** Começo de cada trecho no vídeo editado. */
export function iniciosEditados(cortes: Trecho[]): number[] {
  const r: number[] = [];
  let acc = 0;
  for (const t of cortes) { r.push(acc); acc += t.fim - t.inicio; }
  return r;
}

/** Onde um intervalo da gravação aparece no vídeo editado (pode virar vários pedaços, ou nenhum, com os cortes). */
export function pedacosEditados(cortes: Trecho[], a: number, b: number): { inicio: number; fim: number }[] {
  const r: { inicio: number; fim: number }[] = [];
  let acc = 0;
  for (const t of cortes) {
    const ini = Math.max(a, t.inicio), fim = Math.min(b, t.fim);
    if (fim > ini) r.push({ inicio: acc + ini - t.inicio, fim: acc + fim - t.inicio });
    acc += t.fim - t.inicio;
  }
  return r;
}

/** Divide o trecho no segundo `t` do vídeo editado (não divide colado numa ponta). */
export function dividir(cortes: Trecho[], t: number, novoId: string): Trecho[] {
  const p = paraFonte(cortes, t);
  if (!p) return cortes;
  const alvo = cortes[p.indice];
  if (p.tFonte - alvo.inicio < MINIMO || alvo.fim - p.tFonte < MINIMO) return cortes;
  return [...cortes.slice(0, p.indice), { ...alvo, fim: p.tFonte }, { id: novoId, inicio: p.tFonte, fim: alvo.fim }, ...cortes.slice(p.indice + 1)];
}

/** Tira o trecho do vídeo (sempre sobra pelo menos um). */
export function apagarTrecho(cortes: Trecho[], id: string): Trecho[] {
  return cortes.length <= 1 ? cortes : cortes.filter(t => t.id !== id);
}

/** Apara a ponta de um trecho, sem passar do vizinho na gravação nem ficar menor que 0,1 s. */
export function aparar(cortes: Trecho[], id: string, lado: "inicio" | "fim", tFonte: number, duracaoFonte: number): Trecho[] {
  const i = cortes.findIndex(t => t.id === id);
  if (i < 0) return cortes;
  const t = cortes[i];
  // Vizinhos na gravação (os trechos podem estar fora de ordem depois de mover).
  const antes = Math.max(0, ...cortes.filter(o => o.id !== id && o.fim <= t.inicio + 1e-6).map(o => o.fim));
  const depois = Math.min(duracaoFonte, ...cortes.filter(o => o.id !== id && o.inicio >= t.fim - 1e-6).map(o => o.inicio));
  const n = lado === "inicio" ? { ...t, inicio: limitar(tFonte, antes, t.fim - MINIMO) } : { ...t, fim: limitar(tFonte, t.inicio + MINIMO, depois) };
  return cortes.map(o => (o.id === id ? n : o));
}

/** Muda o trecho de lugar no vídeo final (para antes ou depois do vizinho). */
export function moverTrecho(cortes: Trecho[], id: string, passo: -1 | 1): Trecho[] {
  const i = cortes.findIndex(t => t.id === id), j = i + passo;
  if (i < 0 || j < 0 || j >= cortes.length) return cortes;
  const n = [...cortes];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Tira do vídeo o intervalo [a, b] do tempo editado (divide nas pontas e apaga o meio). */
export function apagarIntervalo(cortes: Trecho[], a: number, b: number, novoId: () => string): Trecho[] {
  const [ini, fim] = a <= b ? [a, b] : [b, a];
  if (fim - ini < MINIMO) return cortes;
  let n = dividir(cortes, fim, novoId());
  n = dividir(n, ini, novoId());
  const inicios = iniciosEditados(n);
  const restam = n.filter((t, i) => {
    const s = inicios[i], e = s + (t.fim - t.inicio);
    return !(s >= ini - 1e-6 && e <= fim + 1e-6);
  });
  return restam.length ? restam : cortes;
}

// ---------------------------------------------------------------- o que vale em cada instante

/** Layout das câmeras no segundo `tFonte` da gravação: a cena mais nova que cobre o instante, ou o layout base. */
export function camadasNoTempo(p: Pick<ProjetoEdicao, "cenas" | "camadasBase">, tFonte: number): Camada[] {
  for (let i = p.cenas.length - 1; i >= 0; i--) {
    const c = p.cenas[i];
    if (tFonte >= c.inicio && tFonte < c.fim) return c.camadas;
  }
  return p.camadasBase;
}

/** Peso de um intervalo no instante (0 fora, 1 no meio, rampa linear nas pontas). */
export function pesoNoIntervalo(inicio: number, fim: number, t: number, rampa: number): number {
  if (t < inicio || t > fim) return 0;
  const r = Math.max(0, Math.min(rampa, (fim - inicio) / 2));
  if (r === 0) return 1;
  return Math.min(1, (t - inicio) / r, (fim - t) / r);
}

/** Ganho (linear) de cada câmera no segundo `tFonte`: volume do canal + destaques; mudo zera. */
export function ganhosNoTempo(p: Pick<ProjetoEdicao, "cameras" | "canais" | "destaques" | "rampa" | "externo">, tFonte: number): Record<string, number> {
  const r: Record<string, number> = {};
  for (const cam of p.cameras) {
    const canal = p.canais[cam.id] ?? CANAL_EDICAO_PADRAO;
    if (canal.mudo || p.externo?.substituir) { r[cam.id] = 0; continue; }
    let db = canal.ganhoDb;
    for (const d of p.destaques) {
      const w = pesoNoIntervalo(d.inicio, d.fim, tFonte, p.rampa);
      if (!w) continue;
      db += d.camera === cam.id ? d.ganhoDb * w : -Math.abs(d.abaixarDb) * w;
    }
    r[cam.id] = dbParaLinear(db);
  }
  return r;
}

/** Destaque que vale no instante (para mostrar na tela qual câmera está em evidência). */
export const destaqueNoTempo = (destaques: Destaque[], tFonte: number) => destaques.find(d => tFonte >= d.inicio && tFonte <= d.fim) ?? null;

/** Véu da transição no segundo `t` do vídeo editado: cor e opacidade (0 = nada). */
export function transicaoNoTempo(cortes: Trecho[], transicoes: Record<string, Transicao>, t: number): { cor: string; alfa: number } {
  const inicios = iniciosEditados(cortes);
  let melhor = { cor: "#000000", alfa: 0 };
  cortes.forEach((trecho, i) => {
    const tr = transicoes[trecho.id];
    if (!tr || tr.tipo === "corte" || tr.duracao <= 0) return;
    const meia = tr.duracao / 2, b = inicios[i];
    // No primeiro trecho a transição é só a entrada (do preto ou do branco para a imagem).
    const dist = i === 0 ? (t >= b ? (t - b) / tr.duracao : Infinity) : Math.abs(t - b) / meia;
    const alfa = dist <= 1 ? 1 - dist : 0;
    if (alfa > melhor.alfa) melhor = { cor: tr.tipo === "clarear" ? "#ffffff" : "#000000", alfa };
  });
  return melhor;
}

export const textosNoTempo = (textos: TextoEdicao[], tFonte: number) => textos.filter(x => tFonte >= x.inicio && tFonte < x.fim);

/** Texto novo com a cara do estilo (legenda embaixo, título no meio, livre um pouco acima do meio). */
export function novoTexto(id: string, inicio: number, fim: number, estilo: EstiloTexto, texto = ""): TextoEdicao {
  const base = { id, inicio, fim, texto, estilo, cor: "#ffffff" };
  if (estilo === "legenda") return { ...base, x: 0.5, y: 0.88, tamanho: 0.055, fundo: true };
  if (estilo === "titulo") return { ...base, x: 0.5, y: 0.5, tamanho: 0.11, fundo: false };
  return { ...base, x: 0.5, y: 0.3, tamanho: 0.07, fundo: false };
}

/** Quebra o texto em linhas que cabem na largura (medida pela função do canvas). */
export function quebrarLinhas(texto: string, largura: number, medir: (s: string) => number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && medir(tentativa) > largura) { linhas.push(atual); atual = palavra; } else atual = tentativa;
    }
    linhas.push(atual);
  }
  return linhas;
}

// ---------------------------------------------------------------- intervalos

/** Ordena e limita um intervalo à gravação (mínimo de 0,1 s). */
export function intervalo(a: number, b: number, duracao: number): { inicio: number; fim: number } {
  const ini = limitar(Math.min(a, b), 0, duracao), fim = limitar(Math.max(a, b), 0, duracao);
  return fim - ini >= MINIMO ? { inicio: ini, fim } : { inicio: ini, fim: Math.min(duracao, ini + 2) };
}

// ---------------------------------------------------------------- legendas em SRT

const hora = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n: number, k = 2) => String(n).padStart(k, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** Legendas do vídeo editado em SRT (as que caíram num trecho cortado ficam de fora). */
export function paraSrt(p: Pick<ProjetoEdicao, "textos" | "cortes">): string {
  const itens = p.textos
    .filter(t => t.estilo === "legenda" && t.texto.trim())
    .map(t => ({ t, a: paraEditado(p.cortes, t.inicio), b: paraEditado(p.cortes, t.fim) }))
    .filter(x => x.a !== null)
    .map(x => ({ ...x, b: x.b ?? (x.a as number) + (x.t.fim - x.t.inicio) }))
    .sort((x, y) => (x.a as number) - (y.a as number));
  return itens.map((x, i) => `${i + 1}\n${hora(x.a as number)} --> ${hora(x.b)}\n${x.t.texto.trim()}\n`).join("\n");
}

/** Lê legendas SRT (no tempo do vídeo editado) e devolve textos presos na gravação. */
export function lerSrt(srt: string, cortes: Trecho[], novoId: () => string): TextoEdicao[] {
  const seg = (h: string) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(h); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000 : NaN; };
  const r: TextoEdicao[] = [];
  for (const bloco of srt.replace(/\r/g, "").split(/\n\s*\n/)) {
    const linhas = bloco.split("\n").map(l => l.trim()).filter(Boolean);
    const i = linhas.findIndex(l => l.includes("-->"));
    if (i < 0) continue;
    const [ha, hb] = linhas[i].split("-->");
    const a = seg(ha), b = seg(hb), texto = linhas.slice(i + 1).join("\n");
    if (!Number.isFinite(a) || !Number.isFinite(b) || !texto) continue;
    const fa = paraFonte(cortes, a), fb = paraFonte(cortes, Math.max(a, b - 0.001));
    if (!fa || !fb) continue;
    const fim = fb.indice === fa.indice ? fb.tFonte : cortes[fa.indice].fim;
    r.push(novoTexto(novoId(), fa.tFonte, Math.max(fa.tFonte + MINIMO, fim), "legenda", texto));
  }
  return r;
}

// ---------------------------------------------------------------- relógio

/** 75.3 → "1:15,3". */
export function relogioEdicao(s: number): string {
  const v = Math.max(0, s), m = Math.floor(v / 60), r = v - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0").replace(".", ",")}`;
}

// ---------------------------------------------------------------- sincronia do áudio externo

/** Junta os canais num só (mono). */
export function mono(canais: Float32Array[]): Float32Array {
  if (canais.length === 1) return canais[0];
  const n = Math.min(...canais.map(c => c.length)), r = new Float32Array(n);
  for (const c of canais) for (let i = 0; i < n; i++) r[i] += c[i] / canais.length;
  return r;
}

/**
 * Envelope de ataques do áudio, em `taxaEnvelope` pontos por segundo: quanto a energia sobe de um bloco para o
 * seguinte (as batidas de bateria e os ataques aparecem iguais na câmera e na mesa, mesmo com timbres diferentes).
 */
export function envelopeDeAtaques(amostras: Float32Array, taxa: number, taxaEnvelope: number): Float32Array {
  // Blocos com borda fracionária: o envelope fica exatamente em `taxaEnvelope` (44,1 kHz / 100 não é inteiro, e um
  // bloco arredondado escorregaria dezenas de milissegundos por minuto).
  const bloco = taxa / taxaEnvelope;
  const n = Math.floor(amostras.length / bloco);
  const e = new Float32Array(n);
  let anterior = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = Math.floor(i * bloco), f = Math.max(a + 1, Math.floor((i + 1) * bloco));
    for (let k = a; k < f; k++) s += amostras[k] * amostras[k];
    const atual = Math.log10(1e-10 + s / (f - a));
    e[i] = i === 0 ? 0 : Math.max(0, atual - anterior);
    anterior = atual;
  }
  // Tira a média e normaliza (o volume de cada fonte não importa).
  let media = 0;
  for (const v of e) media += v;
  media /= n || 1;
  let dp = 0;
  for (let i = 0; i < n; i++) { e[i] -= media; dp += e[i] * e[i]; }
  dp = Math.sqrt(dp / (n || 1)) || 1;
  for (let i = 0; i < n; i++) e[i] /= dp;
  return e;
}

/** FFT complexa no lugar (tamanho potência de 2). */
export function fft(re: Float64Array, im: Float64Array, inversa = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inversa ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inversa) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/**
 * Correlação cruzada: para cada atraso L (−ref.length < L < ext.length), soma de ref[n]·ext[n+L]. Devolve o vetor
 * indexado por L + ref.length − 1.
 */
export function correlacao(ref: Float32Array, ext: Float32Array): Float64Array {
  const total = ref.length + ext.length - 1;
  let n = 1;
  while (n < total) n <<= 1;
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  ar.set(ref); br.set(ext);
  fft(ar, ai); fft(br, bi);
  // conj(A)·B
  for (let i = 0; i < n; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i], m = ar[i] * bi[i] - ai[i] * br[i];
    ar[i] = r; ai[i] = m;
  }
  fft(ar, ai, true);
  const out = new Float64Array(total);
  for (let L = -(ref.length - 1); L < ext.length; L++) out[L + ref.length - 1] = ar[(L + n) % n];
  return out;
}

/** Atraso (em pontos do envelope) com a maior correlação, e quanto ele se destaca dos outros (escore z). */
export function melhorAtraso(ref: Float32Array, ext: Float32Array): { atraso: number; z: number } {
  const c = correlacao(ref, ext);
  let i = 0;
  for (let k = 1; k < c.length; k++) if (c[k] > c[i]) i = k;
  let media = 0;
  for (const v of c) media += v;
  media /= c.length;
  let dp = 0;
  for (const v of c) dp += (v - media) ** 2;
  dp = Math.sqrt(dp / c.length) || 1;
  return { atraso: i - (ref.length - 1), z: (c[i] - media) / dp };
}

/** Correlação direta só em volta de um atraso (para o refinamento fino). */
function refinar(ref: Float32Array, ext: Float32Array, centro: number, raio: number): number {
  let melhor = centro, valor = -Infinity;
  for (let L = centro - raio; L <= centro + raio; L++) {
    let s = 0;
    const a = Math.max(0, -L), b = Math.min(ref.length, ext.length - L);
    for (let k = a; k < b; k++) s += ref[k] * ext[k + L];
    if (s > valor) { valor = s; melhor = L; }
  }
  return melhor;
}

/**
 * Acha o deslocamento do áudio externo em relação ao da câmera: o segundo do externo que toca no segundo 0 da
 * gravação. Primeiro em passos de 10 ms no arquivo todo; depois em passos de 1 ms em volta do achado.
 * `confianca` vai de 0 (chute) a 1 (pico bem destacado).
 */
export function sincronizarAudio(ref: Float32Array, taxaRef: number, ext: Float32Array, taxaExt: number): { deslocamento: number; confianca: number } {
  const GROSSO = 100, FINO = 1000;
  const g = melhorAtraso(envelopeDeAtaques(ref, taxaRef, GROSSO), envelopeDeAtaques(ext, taxaExt, GROSSO));
  // Refinamento: até 60 s da câmera, a partir do ponto em que as duas se sobrepõem.
  const desloc = g.atraso / GROSSO;
  const inicioRef = Math.max(0, -desloc), janela = 60;
  const fatiar = (a: Float32Array, taxa: number, de: number) => a.subarray(Math.floor(de * taxa), Math.floor((de + janela) * taxa));
  const rFino = envelopeDeAtaques(fatiar(ref, taxaRef, inicioRef), taxaRef, FINO);
  const eFino = envelopeDeAtaques(fatiar(ext, taxaExt, Math.max(0, inicioRef + desloc - 0.05)), taxaExt, FINO);
  const base = Math.round((inicioRef + desloc - Math.max(0, inicioRef + desloc - 0.05)) * FINO);
  const L = refinar(rFino, eFino, base, 20);
  const deslocamento = Math.max(0, inicioRef + desloc - 0.05) + L / FINO - inicioRef;
  return { deslocamento: Math.round(deslocamento * 1000) / 1000, confianca: limitar((g.z - 4) / 12, 0, 1) };
}

/** Picos para desenhar a forma de onda (n colunas, de 0 a 1). */
export function picos(amostras: Float32Array, n: number): number[] {
  const r: number[] = [];
  const passo = amostras.length / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * passo), b = Math.min(amostras.length, Math.floor((i + 1) * passo));
    for (let k = a; k < b; k += 4) m = Math.max(m, Math.abs(amostras[k]));
    r.push(Math.min(1, m));
  }
  return r;
}
