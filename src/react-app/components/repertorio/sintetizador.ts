/**
 * Repertório v5: sintetizador do instrumento, no Web Audio, tocando junto da música as notas que aparecem no braço
 * (ou no teclado). Cada instrumento tem um timbre simples feito com osciladores e filtro:
 * - baixo: dente de serra + senoide uma oitava abaixo, filtro passa-baixa que fecha (som de dedo/palheta);
 * - violão: triângulo + dente de serra com filtro que fecha rápido e as cordas do acorde em leve "rasgueado";
 * - teclado: dois triângulos levemente desafinados com sustentação (piano elétrico).
 */
import type { IdInstrumento } from "@/react-app/utils/musica/instrumentos";
import { frequencia } from "@/react-app/utils/musica/sintese";

interface Voz { fontes: OscillatorNode[]; ganho: GainNode; fim: number }

export class Sintetizador {
  private readonly saida: GainNode;
  private vozes: Voz[] = [];

  constructor(private readonly ctx: AudioContext) {
    this.saida = ctx.createGain();
    this.saida.gain.value = 0.6;
    // um compressor evita estourar quando o acorde e a música somam
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.saida.connect(comp).connect(ctx.destination);
  }

  set volume(v: number) { this.saida.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), this.ctx.currentTime, 0.02); }

  /** Toca a nota `midi` daqui a `daqui` s, por `dura` s, com o timbre do instrumento. `indice` espalha o rasgueado. */
  tocar(ins: IdInstrumento, midi: number, daqui: number, dura: number, indice = 0) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + daqui + (ins === "violao" ? indice * 0.014 : 0);
    const f = frequencia(midi);
    const ganho = ctx.createGain();
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.connect(ganho).connect(this.saida);
    const fontes: OscillatorNode[] = [];
    const osc = (tipo: OscillatorType, freq: number, nivel: number, desafino = 0) => {
      const o = ctx.createOscillator();
      o.type = tipo;
      o.frequency.value = freq;
      o.detune.value = desafino;
      const g = ctx.createGain();
      g.gain.value = nivel;
      o.connect(g).connect(filtro);
      fontes.push(o);
    };
    let pico: number, sustenta: number, solta: number, ataque: number;
    if (ins === "teclado") {
      osc("triangle", f, 0.5, -5); osc("triangle", f, 0.5, 5); osc("sine", f * 2, 0.12);
      filtro.frequency.value = Math.min(9000, f * 8);
      ataque = 0.01; pico = 0.22; sustenta = 0.14; solta = 0.35;
    } else if (ins === "violao") {
      osc("triangle", f, 0.7); osc("sawtooth", f, 0.25);
      filtro.frequency.setValueAtTime(Math.min(8000, f * 12), t0);
      filtro.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t0 + 0.6);
      ataque = 0.004; pico = 0.18; sustenta = 0.05; solta = 0.4;
    } else {
      osc("sawtooth", f, 0.45); osc("sine", f / 2, 0.55); osc("sine", f, 0.4);
      filtro.Q.value = 2;
      filtro.frequency.setValueAtTime(Math.min(2400, f * 14), t0);
      filtro.frequency.exponentialRampToValueAtTime(Math.max(160, f * 3), t0 + 0.25);
      ataque = 0.006; pico = 0.42; sustenta = 0.26; solta = 0.12;
    }
    const fimNota = t0 + Math.max(0.08, dura);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
    ganho.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustenta), t0 + ataque + 0.18);
    ganho.gain.setValueAtTime(Math.max(0.0002, sustenta), fimNota);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fimNota + solta);
    for (const o of fontes) { o.start(t0); o.stop(fimNota + solta + 0.05); }
    const voz: Voz = { fontes, ganho, fim: fimNota + solta + 0.05 };
    fontes[0].onended = () => { ganho.disconnect(); this.vozes = this.vozes.filter(v => v !== voz); };
    this.vozes.push(voz);
  }

  /** Corta tudo que está soando ou agendado (pausa, pulo, troca de tom ou de instrumento). */
  calar() {
    const agora = this.ctx.currentTime;
    for (const v of this.vozes) {
      v.ganho.gain.cancelScheduledValues(agora);
      v.ganho.gain.setTargetAtTime(0, agora, 0.015);
      for (const o of v.fontes) { try { o.stop(agora + 0.08); } catch { /* ainda não começou: o stop vale igual */ } }
    }
    this.vozes = [];
  }

  fechar() {
    this.calar();
    this.saida.disconnect();
  }
}
