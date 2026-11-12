/**
 * Motor de áudio do Repertório. Cada faixa (a música inteira ou as separadas) toca num <audio> com
 * `preservesPitch`, ligado a um ganho do Web Audio:
 * - andamento: `playbackRate` (o navegador estica o tempo sem mudar o tom);
 * - tom: a faixa é reamostrada antes (OfflineAudioContext com `playbackRate` = 2^(s/12)), o que sobe/desce o tom e
 *   encurta/alonga; a velocidade do <audio> compensa a duração. O tempo "da música" é o do elemento × esse fator.
 */
import { intercalar, wav16 } from "@/react-app/utils/musica/separacao";

export interface FaixaAudio { id: string; nome: string; original: Blob; volume: number; mudo: boolean; solo: boolean }

interface Tocador { el: HTMLAudioElement; ganho: GainNode; url: string }

type ElementoComPitch = HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };

const fator = (semitons: number) => 2 ** (semitons / 12);

/** Decodifica um arquivo de áudio qualquer (MP3, WAV, M4A, OGG…). */
export async function decodificar(blob: Blob, ctx?: BaseAudioContext): Promise<AudioBuffer> {
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  return c.decodeAudioData(await blob.arrayBuffer());
}

/** Reamostra (e mistura) o áudio para `sr` e `canais` canais. */
export async function reamostrar(buf: AudioBuffer, sr: number, canais: number, velocidade = 1): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(canais, Math.max(1, Math.ceil((buf.duration * sr) / velocidade)), sr);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buf;
  fonte.playbackRate.value = velocidade;
  fonte.connect(ctx.destination);
  fonte.start();
  return ctx.startRendering();
}

/** Faixa com o tom mudado em `semitons` (mais curta ou mais longa), em WAV. */
async function mudarTom(blob: Blob, semitons: number): Promise<Blob> {
  const buf = await decodificar(blob);
  const r = await reamostrar(buf, buf.sampleRate, Math.min(2, buf.numberOfChannels), fator(semitons));
  const L = r.getChannelData(0), R = r.numberOfChannels > 1 ? r.getChannelData(1) : L;
  return new Blob([wav16(intercalar(L, R), r.sampleRate)], { type: "audio/wav" });
}

export class MotorAudio {
  private ctx: AudioContext | null = null;
  private tocadores = new Map<string, Tocador>();
  private faixas: FaixaAudio[] = [];
  private semitons = 0;
  private andamento = 1;
  private tocando = false;
  /** Avisado quando a música termina ou o estado muda. */
  aoMudar?: () => void;

  get estaTocando() { return this.tocando; }
  get tom() { return this.semitons; }

  private contexto() {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private mestre(): Tocador | undefined {
    return this.tocadores.get(this.faixas[0]?.id ?? "");
  }

  /** Tempo atual na música original (s). */
  tempo(): number {
    const m = this.mestre();
    return m ? m.el.currentTime * fator(this.semitons) : 0;
  }

  /** Troca as faixas (ex.: depois de separar). Mantém a posição e se estava tocando. */
  async definirFaixas(faixas: FaixaAudio[]) {
    const t = this.tempo(), tocava = this.tocando;
    this.pausar();
    for (const tc of this.tocadores.values()) this.desligar(tc);
    this.tocadores.clear();
    this.faixas = faixas;
    await this.montar(t);
    if (tocava) await this.tocar();
  }

  private desligar(tc: Tocador) {
    tc.el.pause();
    tc.el.removeAttribute("src");
    tc.el.load();
    tc.ganho.disconnect();
    URL.revokeObjectURL(tc.url);
  }

  private async montar(tempo: number) {
    const ctx = this.contexto();
    const blobs = await Promise.all(this.faixas.map(f => (this.semitons ? mudarTom(f.original, this.semitons) : Promise.resolve(f.original))));
    for (const [i, f] of this.faixas.entries()) {
      const url = URL.createObjectURL(blobs[i]);
      const el = new Audio() as ElementoComPitch;
      el.preload = "auto";
      el.src = url;
      el.preservesPitch = true; el.webkitPreservesPitch = true; el.mozPreservesPitch = true;
      const ganho = ctx.createGain();
      ctx.createMediaElementSource(el).connect(ganho).connect(ctx.destination);
      if (i === 0) el.onended = () => { this.tocando = false; this.aoMudar?.(); };
      this.tocadores.set(f.id, { el, ganho, url });
    }
    await Promise.all([...this.tocadores.values()].map(tc => new Promise<void>(ok => {
      if (tc.el.readyState >= 1) ok(); else { tc.el.onloadedmetadata = () => ok(); tc.el.onerror = () => ok(); }
    })));
    this.aplicarVelocidade();
    this.aplicarVolumes();
    this.irPara(tempo);
  }

  private aplicarVelocidade() {
    const v = this.andamento / fator(this.semitons);
    for (const tc of this.tocadores.values()) tc.el.playbackRate = v;
  }

  aplicarVolumes() {
    const algumSolo = this.faixas.some(f => f.solo);
    for (const f of this.faixas) {
      const tc = this.tocadores.get(f.id);
      if (!tc) continue;
      const ouvir = !f.mudo && (!algumSolo || f.solo);
      tc.ganho.gain.value = ouvir ? f.volume : 0;
    }
  }

  /** Muda volume/mudo/solo de uma faixa na hora. */
  ajustarFaixa(id: string, parcial: Partial<Pick<FaixaAudio, "volume" | "mudo" | "solo">>) {
    this.faixas = this.faixas.map(f => (f.id === id ? { ...f, ...parcial } : f));
    this.aplicarVolumes();
  }

  async tocar() {
    const ctx = this.contexto();
    if (ctx.state === "suspended") await ctx.resume();
    const els = [...this.tocadores.values()].map(t => t.el);
    const m = this.mestre();
    if (m && m.el.ended) this.irPara(0);
    this.sincronizar();
    await Promise.all(els.map(e => e.play().catch(() => undefined)));
    this.tocando = true;
    this.aoMudar?.();
  }

  pausar() {
    for (const tc of this.tocadores.values()) tc.el.pause();
    this.tocando = false;
    this.aoMudar?.();
  }

  /** Vai para o tempo `t` da música original. */
  irPara(t: number) {
    const pos = Math.max(0, t / fator(this.semitons));
    for (const tc of this.tocadores.values()) tc.el.currentTime = pos;
    this.aoMudar?.();
  }

  /** Mantém as faixas juntas (chamado a cada quadro). */
  sincronizar() {
    const m = this.mestre();
    if (!m) return;
    for (const tc of this.tocadores.values()) if (tc !== m && Math.abs(tc.el.currentTime - m.el.currentTime) > 0.05) tc.el.currentTime = m.el.currentTime;
  }

  setAndamento(a: number) {
    this.andamento = Math.max(0.5, Math.min(1.5, a));
    this.aplicarVelocidade();
  }

  /** Muda o tom (reprocessa as faixas; leva alguns segundos). */
  async setTom(semitons: number) {
    if (semitons === this.semitons) return;
    const t = this.tempo(), tocava = this.tocando;
    this.pausar();
    for (const tc of this.tocadores.values()) this.desligar(tc);
    this.tocadores.clear();
    this.semitons = semitons;
    await this.montar(t);
    if (tocava) await this.tocar();
  }

  fechar() {
    this.pausar();
    for (const tc of this.tocadores.values()) this.desligar(tc);
    this.tocadores.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
