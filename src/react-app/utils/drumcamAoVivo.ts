/**
 * Drumcam v3 (ao vivo): regras puras do estúdio e do monitoramento.
 *
 * A câmera ao vivo é o próprio navegador (ou o app NordTool 8.0+) de um celular: ela transmite por WebRTC direto
 * para o painel; o relé do NordTool só passa o "sinal" (oferta, resposta, candidatos). Aqui ficam o protocolo do
 * sinal e dos comandos, a geometria das câmeras no vídeo (posições, layouts, recorte), os filtros, o mixer, o zoom
 * por pinça, a detecção de movimento e o acerto de relógio entre os aparelhos.
 */

// ---------------------------------------------------------------- sinal (pelo relé)

export type SinalAoVivo =
  | { tipo: "quero"; qualidade: Qualidade }
  | { tipo: "oferta"; sdp: string }
  | { tipo: "resposta"; sdp: string }
  | { tipo: "candidato"; c: RTCIceCandidateInit }
  | { tipo: "fim" };
export type Qualidade = "baixa" | "media" | "alta";

/** Valida o sinal que chegou pelo relé (vem de outro aparelho: nunca confiar no formato). */
export function lerSinal(d: unknown): SinalAoVivo | null {
  const s = d as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return null;
  if (s.tipo === "quero") return { tipo: "quero", qualidade: s.qualidade === "baixa" || s.qualidade === "alta" ? s.qualidade : "media" };
  if ((s.tipo === "oferta" || s.tipo === "resposta") && typeof s.sdp === "string" && s.sdp.length < 60_000) return { tipo: s.tipo, sdp: s.sdp };
  if (s.tipo === "candidato" && s.c && typeof s.c === "object") {
    const c = s.c as Record<string, unknown>;
    if (typeof c.candidate !== "string" || c.candidate.length > 2_000) return null;
    return { tipo: "candidato", c: { candidate: c.candidate, sdpMid: typeof c.sdpMid === "string" ? c.sdpMid : null, sdpMLineIndex: typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null } };
  }
  if (s.tipo === "fim") return { tipo: "fim" };
  return null;
}

/** Limite de envio por qualidade: grade do monitoramento (baixa), estúdio (média) e tela cheia/gravação (alta). */
export const QUALIDADES: Record<Qualidade, { maxBitrate: number; escala: number; fps: number }> = {
  baixa: { maxBitrate: 450_000, escala: 2, fps: 20 },
  media: { maxBitrate: 1_500_000, escala: 1, fps: 30 },
  alta: { maxBitrate: 4_000_000, escala: 1, fps: 30 },
};

/** Servidores STUN públicos (descobrir o endereço pela internet). No mesmo Wi-Fi nem são usados. */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

// ---------------------------------------------------------------- comandos (canal de dados, painel ↔ câmera)

export type Comando =
  | { c: "estado" }
  | { c: "zoom"; valor: number }
  | { c: "lente"; lente: string }
  | { c: "lanterna"; ligada: boolean }
  | { c: "foto" }
  | { c: "nome"; nome: string }
  | { c: "qualidade"; qualidade: Qualidade }
  | { c: "relogio" }
  | { c: "gravar"; sessao: string }
  | { c: "parar" }
  | { c: "arquivo"; sessao: string }
  | { c: "microfone"; ligado: boolean }
  | { c: "resolucao"; altura: number };

const COMANDOS = new Set(["estado", "zoom", "lente", "lanterna", "foto", "nome", "qualidade", "relogio", "gravar", "parar", "arquivo", "microfone", "resolucao"]);

/** Valida um comando recebido pela câmera. */
export function lerComando(d: unknown): (Comando & { id: number }) | null {
  const m = d as Record<string, unknown> | null;
  if (!m || typeof m !== "object" || typeof m.id !== "number" || typeof m.c !== "string" || !COMANDOS.has(m.c)) return null;
  const id = m.id;
  switch (m.c) {
    case "zoom": return typeof m.valor === "number" && Number.isFinite(m.valor) ? { id, c: "zoom", valor: m.valor } : null;
    case "lente": return typeof m.lente === "string" && m.lente.length < 300 ? { id, c: "lente", lente: m.lente } : null;
    case "lanterna": return { id, c: "lanterna", ligada: m.ligada === true };
    case "nome": return typeof m.nome === "string" ? { id, c: "nome", nome: m.nome.slice(0, 60) } : null;
    case "qualidade": return { id, c: "qualidade", qualidade: m.qualidade === "baixa" || m.qualidade === "alta" ? m.qualidade : "media" };
    case "gravar": case "arquivo": return typeof m.sessao === "string" && /^[\w-]{1,40}$/.test(m.sessao) ? { id, c: m.c, sessao: m.sessao } : null;
    case "microfone": return { id, c: "microfone", ligado: m.ligado !== false };
    case "resolucao": return typeof m.altura === "number" && [480, 720, 1080, 1440, 2160].includes(m.altura) ? { id, c: "resolucao", altura: m.altura } : null;
    default: return { id, c: m.c as "estado" | "foto" | "relogio" | "parar" };
  }
}

/** Estado que a câmera manda ao painel. */
export interface EstadoCamera {
  nome: string;
  bateria: number | null;
  carregando: boolean | null;
  largura: number;
  altura: number;
  zoom: { min: number; max: number; passo: number; valor: number } | null;
  lentes: Lente[];
  lente: string;
  lanterna: boolean | null;
  microfone: boolean;
  gravando: string | null;
  gravandoDesde: number | null;
  arquivo: { sessao: string; tamanho: number; mime: string; inicio: number } | null;
}

// ---------------------------------------------------------------- lentes e zoom

export interface Lente { id: string; nome: string; fator: number; frente: boolean }

/**
 * Lentes da câmera pelos nomes que o aparelho dá ("camera2 2, facing back", "Ultra Wide"...). A de trás principal
 * vale 1×; ultra-angular 0,5×; tele 2× (ou 3×, se o nome disser); a da frente fica à parte.
 */
export function lentesDosDispositivos(dispositivos: { deviceId: string; label: string }[]): Lente[] {
  const lentes: Lente[] = [];
  let principal = false;
  dispositivos.forEach((d, i) => {
    const r = d.label.toLowerCase();
    const frente = /front|frontal|user|facetime|selfie/.test(r);
    let fator = 1;
    if (/ultra|0[.,]5|wide-angle|grande angular|grande-angular/.test(r)) fator = 0.5;
    else if (/tele|zoom|[^.]3x|2x/.test(r)) fator = /3x|3 x|periscope/.test(r) ? 3 : 2;
    const nome = frente ? "Frontal" : fator === 1 ? (principal ? `Traseira ${i + 1}` : "Principal") : `${String(fator).replace(".", ",")}×`;
    if (!frente && fator === 1) principal = true;
    lentes.push({ id: d.deviceId, nome, fator, frente });
  });
  return lentes;
}

/** Botões de zoom rápido (0,5× · 1× · 2× · 5×…) que fazem sentido para o que a câmera oferece. */
export function botoesDeZoom(zoom: { min: number; max: number } | null, lentes: Lente[]): number[] {
  const b = new Set<number>([1]);
  if (lentes.some(l => l.fator === 0.5 && !l.frente) || (zoom && zoom.min <= 0.5)) b.add(0.5);
  const max = Math.max(zoom?.max ?? 1, ...lentes.filter(l => !l.frente).map(l => l.fator));
  for (const z of [2, 3, 5, 10]) if (max >= z) b.add(z);
  return [...b].sort((a, x) => a - x);
}

/** Zoom pela pinça: a distância entre os dedos multiplica o zoom de quando a pinça começou. */
export function zoomPorPinca(zoomInicial: number, distanciaInicial: number, distanciaAtual: number, min: number, max: number): number {
  if (distanciaInicial <= 0) return zoomInicial;
  const z = zoomInicial * (distanciaAtual / distanciaInicial);
  return Math.round(Math.min(max, Math.max(min, z)) * 100) / 100;
}

/**
 * Zoom pedido (pode ser 0,5×) → qual lente usar e com quanto de zoom nela. Abaixo de 1× vai para a ultra-angular,
 * se houver; acima, a lente tele quando o zoom passa do fator dela (mais nitidez que o digital).
 */
export function lenteParaZoom(pedido: number, lentes: Lente[], atual: string): { lente: string; zoom: number } {
  const tras = lentes.filter(l => !l.frente);
  const atualL = lentes.find(l => l.id === atual);
  if (atualL?.frente) return { lente: atual, zoom: Math.max(1, pedido) };
  const candidatas = tras.length ? tras : lentes;
  if (!candidatas.length) return { lente: atual, zoom: pedido };
  // A maior lente que não passa do zoom pedido (a ultra-angular se o pedido for < 1).
  const ordenadas = [...candidatas].sort((a, b) => a.fator - b.fator);
  let escolhida = ordenadas[0];
  for (const l of ordenadas) if (l.fator <= pedido + 1e-6) escolhida = l;
  return { lente: escolhida.id, zoom: Math.max(1, Math.round((pedido / escolhida.fator) * 100) / 100) };
}

// ---------------------------------------------------------------- posições das câmeras no vídeo

/** Uma câmera dentro do vídeo: posição e tamanho em fração da tela (0 a 1). */
export interface Camada {
  id: string;
  x: number; y: number; w: number; h: number;
  z: number;
  /** Cobrir (corta as sobras) ou conter (mostra tudo, com faixas). */
  ajuste: "cobrir" | "conter";
  raio: number;
  visivel: boolean;
  espelhar: boolean;
}
export type Layout = "lado" | "pip" | "grade" | "empilhado" | "destaque" | "unica";
export type Formato = "16:9" | "9:16" | "1:1";
export const DIMENSOES: Record<Formato, { w: number; h: number }> = { "16:9": { w: 1920, h: 1080 }, "9:16": { w: 1080, h: 1920 }, "1:1": { w: 1080, h: 1080 } };

const camada = (id: string, x: number, y: number, w: number, h: number, z: number, extra: Partial<Camada> = {}): Camada =>
  ({ id, x, y, w, h, z, ajuste: "cobrir", raio: 0, visivel: true, espelhar: false, ...extra });

/** Posições iniciais das câmeras para cada layout. */
export function layoutPadrao(ids: string[], layout: Layout, formato: Formato = "16:9"): Camada[] {
  const n = ids.length;
  if (!n) return [];
  const vertical = formato === "9:16";
  if (layout === "unica" || n === 1) return ids.map((id, i) => camada(id, 0, 0, 1, 1, i, { visivel: i === 0 }));
  if (layout === "pip") {
    // A primeira ocupa a tela; as outras ficam em janelinhas no canto de baixo à direita.
    const pw = vertical ? 0.36 : 0.28, ph = vertical ? 0.2 : 0.28, m = 0.03;
    return ids.map((id, i) => i === 0 ? camada(id, 0, 0, 1, 1, 0)
      : camada(id, 1 - m - pw, 1 - m - ph - (i - 1) * (ph + m), pw, ph, i, { raio: 0.04 }));
  }
  if (layout === "destaque") {
    // Uma grande e as outras numa faixa.
    const faixa = 0.25;
    return ids.map((id, i) => {
      if (i === 0) return vertical ? camada(id, 0, 0, 1, 1 - faixa, 0) : camada(id, 0, 0, 1 - faixa, 1, 0);
      const k = n - 1, t = 1 / k;
      return vertical ? camada(id, (i - 1) * t, 1 - faixa, t, faixa, i) : camada(id, 1 - faixa, (i - 1) * t, faixa, t, i);
    });
  }
  if (layout === "lado" || layout === "empilhado") {
    // "Lado a lado" em colunas; "empilhado" em linhas.
    const emLinha = layout === "lado";
    const t = 1 / n;
    return ids.map((id, i) => emLinha ? camada(id, i * t, 0, t, 1, i) : camada(id, 0, i * t, 1, t, i));
  }
  // Grade.
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  return ids.map((id, i) => camada(id, (i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows, i));
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Arrastar a câmera: não sai da tela. */
export function moverCamada(c: Camada, dx: number, dy: number): Camada {
  return { ...c, x: limitar(c.x + dx, 0, 1 - c.w), y: limitar(c.y + dy, 0, 1 - c.h) };
}

/** Redimensionar pelo canto (ne, no, se, so); mínimo de 8% e sem sair da tela. */
export function redimensionarCamada(c: Camada, canto: "no" | "ne" | "so" | "se", dx: number, dy: number, proporcao?: number): Camada {
  const MIN = 0.08;
  let { x, y, w, h } = c;
  if (canto.includes("e")) w = limitar(w + dx, MIN, 1 - x);
  else { const nx = limitar(x + dx, 0, x + w - MIN); w += x - nx; x = nx; }
  if (canto.includes("s")) h = limitar(h + dy, MIN, 1 - y);
  else { const ny = limitar(y + dy, 0, y + h - MIN); h += y - ny; y = ny; }
  if (proporcao) {
    // Mantém a proporção pela largura (ajustando a altura e, se faltar espaço, a largura).
    h = w / proporcao;
    if (canto.includes("n")) y = c.y + c.h - h;
    if (y < 0) { y = 0; h = canto.includes("n") ? c.y + c.h : h; w = h * proporcao; }
    if (y + h > 1) { h = 1 - y; w = h * proporcao; }
  }
  return { ...c, x, y, w, h };
}

/** Traz a câmera para a frente das outras. */
export function paraFrente(camadas: Camada[], id: string): Camada[] {
  const max = Math.max(...camadas.map(c => c.z));
  return camadas.map(c => c.id === id ? { ...c, z: max + 1 } : c);
}

/** Recorte da imagem da câmera e onde desenhar na saída (cobrir corta as sobras; conter mostra tudo). */
export function retanguloDeDesenho(origemW: number, origemH: number, c: Camada, saidaW: number, saidaH: number) {
  const dx = c.x * saidaW, dy = c.y * saidaH, dw = c.w * saidaW, dh = c.h * saidaH;
  if (origemW <= 0 || origemH <= 0) return { sx: 0, sy: 0, sw: 0, sh: 0, dx, dy, dw, dh };
  const ro = origemW / origemH, rd = dw / dh;
  if (c.ajuste === "cobrir") {
    if (ro > rd) { const sw = origemH * rd; return { sx: (origemW - sw) / 2, sy: 0, sw, sh: origemH, dx, dy, dw, dh }; }
    const sh = origemW / rd;
    return { sx: 0, sy: (origemH - sh) / 2, sw: origemW, sh, dx, dy, dw, dh };
  }
  if (ro > rd) { const h = dw / ro; return { sx: 0, sy: 0, sw: origemW, sh: origemH, dx, dy: dy + (dh - h) / 2, dw, dh: h }; }
  const w = dh * ro;
  return { sx: 0, sy: 0, sw: origemW, sh: origemH, dx: dx + (dw - w) / 2, dy, dw: w, dh };
}

// ---------------------------------------------------------------- filtros

export interface Filtro {
  brilho: number; contraste: number; saturacao: number; matiz: number;
  pb: number; sepia: number; desfoque: number; temperatura: number; vinheta: number;
}
export const FILTRO_NEUTRO: Filtro = { brilho: 100, contraste: 100, saturacao: 100, matiz: 0, pb: 0, sepia: 0, desfoque: 0, temperatura: 0, vinheta: 0 };
export const PRESETS: Record<string, { nome: string; filtro: Filtro }> = {
  normal: { nome: "Normal", filtro: FILTRO_NEUTRO },
  vivo: { nome: "Vívido", filtro: { ...FILTRO_NEUTRO, contraste: 115, saturacao: 140 } },
  palco: { nome: "Palco", filtro: { ...FILTRO_NEUTRO, brilho: 108, contraste: 120, saturacao: 115, vinheta: 35 } },
  pb: { nome: "P&B", filtro: { ...FILTRO_NEUTRO, pb: 100, contraste: 115 } },
  sepia: { nome: "Sépia", filtro: { ...FILTRO_NEUTRO, sepia: 80, contraste: 105 } },
  quente: { nome: "Quente", filtro: { ...FILTRO_NEUTRO, temperatura: 40, saturacao: 110 } },
  frio: { nome: "Frio", filtro: { ...FILTRO_NEUTRO, temperatura: -40 } },
  cinema: { nome: "Cinema", filtro: { ...FILTRO_NEUTRO, contraste: 125, saturacao: 80, vinheta: 50, brilho: 95 } },
};

/**
 * Filtro → `ctx.filter` do canvas. A temperatura (quente/frio) vira um toque de sépia com giro de matiz: quente puxa
 * para o laranja, frio para o azul. A vinheta é desenhada à parte (gradiente nas bordas).
 */
export function cssDoFiltro(f: Filtro): string {
  const partes: string[] = [];
  if (f.brilho !== 100) partes.push(`brightness(${f.brilho}%)`);
  if (f.contraste !== 100) partes.push(`contrast(${f.contraste}%)`);
  if (f.saturacao !== 100) partes.push(`saturate(${f.saturacao}%)`);
  if (f.pb) partes.push(`grayscale(${f.pb}%)`);
  const sepia = Math.min(100, f.sepia + Math.abs(f.temperatura) * 0.35);
  if (sepia) partes.push(`sepia(${Math.round(sepia)}%)`);
  const matiz = f.matiz + (f.temperatura < 0 ? 180 + f.temperatura * 0.3 : f.temperatura * -0.15);
  if (Math.round(matiz)) partes.push(`hue-rotate(${Math.round(matiz)}deg)`);
  if (f.desfoque) partes.push(`blur(${f.desfoque}px)`);
  return partes.length ? partes.join(" ") : "none";
}

// ---------------------------------------------------------------- mixer

export interface Canal { ganho: number; mudo: boolean; solo: boolean; pan: number }
export const CANAL_PADRAO: Canal = { ganho: 1, mudo: false, solo: false, pan: 0 };

/** Ganho que vale de fato: mudo zera; com algum canal em solo, só os em solo tocam. */
export function ganhoEfetivo(canal: Canal, algumSolo: boolean): number {
  if (canal.mudo) return 0;
  if (algumSolo && !canal.solo) return 0;
  return Math.max(0, Math.min(2, canal.ganho));
}

export const dbDoGanho = (g: number) => (g <= 0 ? -Infinity : 20 * Math.log10(g));
export const ganhoDoDb = (db: number) => (db === -Infinity ? 0 : 10 ** (db / 20));

/** Nível do medidor (0 a 1) pelo RMS do áudio, numa escala de -60 dB a 0 dB. */
export function nivelDoMedidor(amostras: Float32Array | number[]): number {
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) soma += amostras[i] * amostras[i];
  const rms = Math.sqrt(soma / Math.max(1, amostras.length));
  const db = dbDoGanho(rms);
  return db === -Infinity ? 0 : Math.max(0, Math.min(1, (db + 60) / 60));
}

// ---------------------------------------------------------------- movimento

/**
 * Detecção de movimento entre dois quadros pequenos (RGBA): fração dos pixels cujo brilho mudou mais que o limiar.
 * Comparar em baixa resolução (ex.: 64×36) já ignora ruído fino e é barato o bastante para várias câmeras.
 */
export function fracaoDeMovimento(a: Uint8ClampedArray, b: Uint8ClampedArray, limiar = 28): number {
  if (a.length !== b.length || !a.length) return 0;
  let mudou = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    const lb = b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
    if (Math.abs(la - lb) > limiar) mudou++;
  }
  return mudou / n;
}

/** Sensibilidade (1 a 10) → fração mínima de pixels mudados para contar como movimento. */
export const limiarDaSensibilidade = (s: number) => [0.2, 0.12, 0.08, 0.05, 0.035, 0.025, 0.018, 0.012, 0.008, 0.005][Math.max(1, Math.min(10, Math.round(s))) - 1];

/** Precisa de alguns quadros seguidos com movimento (descarta um piscar de luz) e espera um tempo entre avisos. */
export function novoAvisoDeMovimento(historico: boolean[], ultimoAviso: number, agora: number, intervaloMs = 10_000, seguidos = 2): boolean {
  if (historico.length < seguidos) return false;
  return historico.slice(-seguidos).every(Boolean) && agora - ultimoAviso >= intervaloMs;
}

// ---------------------------------------------------------------- relógio e arquivos

/** Diferença de relógio da câmera (pelo pedido de "relogio"): hora da câmera − meio do caminho da ida e volta. */
export const diferencaDeRelogio = (enviadoEm: number, horaCamera: number, recebidoEm: number) => horaCamera - (enviadoEm + recebidoEm) / 2;

/** Atraso de cada arquivo para alinhar as câmeras (todas começam juntas no vídeo montado). */
export function alinhamento(inicios: { id: string; inicio: number; diferenca: number }[]): Record<string, number> {
  const locais = inicios.map(i => ({ id: i.id, t: i.inicio - i.diferenca }));
  const ultimo = Math.max(...locais.map(l => l.t));
  return Object.fromEntries(locais.map(l => [l.id, (ultimo - l.t) / 1000]));
}

/** Partes de um arquivo para o canal de dados (até 64 KB cada, o que passa bem em qualquer navegador). */
export function partesDoArquivo(tamanho: number, parte = 64 * 1024): { inicio: number; fim: number }[] {
  const r: { inicio: number; fim: number }[] = [];
  for (let i = 0; i < tamanho; i += parte) r.push({ inicio: i, fim: Math.min(tamanho, i + parte) });
  return r;
}

/** Melhor formato de gravação que o navegador aceita (MP4 primeiro, que abre em todo lugar). */
export function formatoDeGravacao(suporta: (mime: string) => boolean): { mime: string; ext: "mp4" | "webm" } {
  for (const m of ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4"]) if (suporta(m)) return { mime: m, ext: "mp4" };
  for (const m of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) if (suporta(m)) return { mime: m, ext: "webm" };
  return { mime: "", ext: "webm" };
}

/** Nome do arquivo: "Drumcam 2026-11-23 18h05.mp4". */
export function nomeDoArquivo(prefixo: string, data: Date, ext: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefixo} ${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())} ${p(data.getHours())}h${p(data.getMinutes())}${p(data.getSeconds())}.${ext}`;
}

/** 75 → "1:15"; 3725 → "1:02:05". */
export function duracaoTexto(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** 1536 → "1,5 KB"; 3_500_000 → "3,3 MB". */
export function tamanhoTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const u = ["KB", "MB", "GB"];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0).replace(".", ",")} ${u[i]}`;
}
