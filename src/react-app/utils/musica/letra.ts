/**
 * Repertório v11 — identificar a letra: o reconhecimento de fala (Whisper, no aparelho) devolve trechos com o tempo;
 * aqui eles viram as linhas da letra (com o começo de cada uma) para o "Escrever cifra". Também escolhe onde cortar o
 * áudio em janelas de até 30 s (nos pontos mais silenciosos) e limpa o que o modelo inventa em trechos sem voz.
 * Puro, testável em node.
 */
import type { SegmentoAcorde } from "./analise.ts";
import type { EscritaCifra, MarcaAcorde } from "./escritaCifra.ts";

export interface TrechoFalado { inicio: number; fim: number; texto: string }
export interface LinhaLetra { inicio: number; texto: string }

/** Taxa que o modelo espera. */
export const SR_FALA = 16000;
/** Janela máxima do modelo (s). */
export const JANELA_FALA = 30;

/**
 * Onde cortar o sinal (amostras a 16 kHz) em janelas de até `janela` s: cada corte cai no trecho mais silencioso
 * entre `minimo` e `janela` s depois do anterior (energia em blocos de 50 ms). Devolve os limites [0, …, fim].
 */
export function cortesDeJanela(sinal: Float32Array, sr = SR_FALA, janela = JANELA_FALA, minimo = 20): number[] {
  const bloco = Math.round(sr * 0.05);
  const nb = Math.ceil(sinal.length / bloco);
  const energia = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    let s = 0;
    const fim = Math.min(sinal.length, (b + 1) * bloco);
    for (let i = b * bloco; i < fim; i++) s += sinal[i] * sinal[i];
    energia[b] = s / Math.max(1, fim - b * bloco);
  }
  const cortes = [0];
  const porJanela = Math.floor((janela * sr) / bloco), porMinimo = Math.floor((minimo * sr) / bloco);
  let atual = 0;
  while (nb - atual > porJanela) {
    let melhor = atual + porJanela, menor = Infinity;
    // média móvel de 300 ms para não cortar num respiro curto no meio de uma palavra
    for (let b = atual + porMinimo; b < atual + porJanela; b++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += energia[Math.min(nb - 1, Math.max(0, b + k))];
      if (s < menor) { menor = s; melhor = b; }
    }
    cortes.push(melhor * bloco);
    atual = melhor;
  }
  cortes.push(sinal.length);
  return cortes;
}

/**
 * Onde ouvir em seguida (amostras), como no Whisper original: se o modelo parou antes do fim da janela (o último trecho
 * acabou em `ultimoFim` s dentro dela) e ainda sobram 5 s ou mais, recomeça dali; se chegou perto do fim, não
 * reconheceu nada ou não andou, segue para o fim da janela.
 */
export function proximoInicio(inicio: number, fimJanela: number, ultimoFim: number | null, sr = SR_FALA): number {
  if (ultimoFim === null) return fimJanela;
  const pos = inicio + Math.round(ultimoFim * sr);
  // sobrando pouco (só o fim da música do trecho), não vale: o modelo inventa frases na parte instrumental
  if (pos >= fimJanela - 5 * sr || pos <= inicio + sr) return fimJanela;
  return pos;
}

/** Frases que o modelo costuma inventar em trechos só de música (legendas de vídeo etc.). */
const INVENTADAS = [
  /^obrigad[oa]s?( por (assistir|ver))?[.!]*$/i,
  /legenda(s|do|da)?( (por|pela))?/i,
  /amara\.org/i,
  /inscreva-se|se inscreva|deixe (o )?seu like|ative o sininho/i,
  /^(m[uú]sica|aplausos|risos|instrumental)$/i,
  /^tchau[.!]*$/i,
  /subtitles?|thanks for watching/i,
];

/** Limpa o texto de um trecho: tira notas musicais, colchetes e parênteses do modelo; "" se for invenção. */
export function limparTrecho(texto: string): string {
  const t = texto
    .replace(/[♪♫♩♬]/g, " ")
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nu = t.replace(/[.!?,;:…-]/g, "").trim();
  if (!nu) return "";
  if (INVENTADAS.some(r => r.test(nu))) return "";
  // só interjeições ("e aí e aí", "ah ah", "hum"): o modelo inventa isso em trecho instrumental
  if (/^(?:(?:e )?a[ií]|ah+|uh+|hum+|hm+|eh+)(?: (?:(?:e )?a[ií]|ah+|uh+|hum+|hm+|eh+))*$/i.test(nu.toLowerCase().replace(/\s+/g, " "))) return "";
  return t;
}

/** Quebra um texto longo em linhas de até `max` letras (na pontuação, se der; senão entre palavras). */
export function quebrarLinha(texto: string, max = 42): string[] {
  if (texto.length <= max) return [texto];
  // primeiro na pontuação
  const partes = texto.split(/(?<=[,.;!?])\s+/).filter(Boolean);
  if (partes.length > 1 && partes.every(p => p.length <= max)) return juntarPequenas(partes, max);
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(" ")) {
    if (atual && (atual + " " + p).length > max) { linhas.push(atual); atual = p; } else atual = atual ? `${atual} ${p}` : p;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function juntarPequenas(partes: string[], max: number): string[] {
  const r: string[] = [];
  for (const p of partes) {
    const ult = r[r.length - 1];
    if (ult !== undefined && ult.length + 1 + p.length <= max && ult.length < max / 2) r[r.length - 1] = `${ult} ${p}`;
    else r.push(p);
  }
  return r;
}

/** Tira a pontuação final de verso ("Levanta a parede." → "Levanta a parede"), como se escreve letra de música. */
const semPontoFinal = (s: string) => s.replace(/[.;]+$/, "").trim();

/**
 * Os trechos reconhecidos viram linhas da letra, cada uma com o tempo em que começa: trechos inventados saem, os
 * longos se quebram (o tempo de cada pedaço é proporcional às letras), e a mesma frase repetida mais de duas vezes
 * seguidas (o modelo "trava") fica só duas.
 */
export function linhasDosTrechos(trechos: TrechoFalado[], max = 42): LinhaLetra[] {
  const linhas: LinhaLetra[] = [];
  let repetida = 0;
  for (const tr of [...trechos].sort((a, b) => a.inicio - b.inicio)) {
    const texto = limparTrecho(tr.texto);
    if (!texto) continue;
    const pedacos = quebrarLinha(texto, max);
    const total = pedacos.reduce((s, p) => s + p.length, 0);
    const dur = Math.max(0, tr.fim - tr.inicio);
    let feito = 0;
    for (const p of pedacos) {
      const linha = semPontoFinal(p);
      const inicio = Math.round((tr.inicio + (dur * feito) / Math.max(1, total)) * 100) / 100;
      feito += p.length;
      if (!linha) continue;
      const ant = linhas[linhas.length - 1];
      if (ant && ant.texto.toLowerCase() === linha.toLowerCase()) { if (++repetida >= 2) continue; } else repetida = 0;
      linhas.push({ inicio, texto: linha });
    }
  }
  return linhas;
}

/**
 * A letra para o "Escrever cifra": uma linha por verso e uma linha vazia entre estrofes (pausa de `pausa` s ou mais
 * entre o fim de um trecho e o começo do próximo — aqui medida entre começos, com a duração média das linhas).
 * Os acordes da escrita ficam como estavam.
 */
export function escritaDaLetra(linhas: LinhaLetra[], base: EscritaCifra, pausa = 6): EscritaCifra {
  const partes: string[] = [];
  linhas.forEach((l, i) => {
    if (i > 0 && l.inicio - linhas[i - 1].inicio >= pausa) partes.push("");
    partes.push(l.texto);
  });
  return { ...base, letra: partes.join("\n"), inicios: linhas.map(l => l.inicio) };
}

/** Os acordes reconhecidos no áudio como marcas do "Escrever cifra" (sem "N"; iguais seguidos viram um). */
export function marcasDosAcordes(acordes: SegmentoAcorde[]): MarcaAcorde[] {
  const r: MarcaAcorde[] = [];
  for (const a of acordes) {
    if (a.acorde === "N") continue;
    if (r.length && r[r.length - 1].acorde === a.acorde) continue;
    r.push({ tempo: Math.round(a.inicio * 1000) / 1000, acorde: a.acorde });
  }
  return r;
}
