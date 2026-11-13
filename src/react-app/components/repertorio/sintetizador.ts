/**
 * Repertório: sintetizador no Web Audio. v5: toca, junto da música, as notas que aparecem no braço ou no teclado.
 * v6: também é o som do instrumento online e do estúdio ("Criar") — notas seguradas ao vivo (`iniciar`), bateria,
 * um timbre de sintetizador e a renderização offline (exportar a música em WAV). Timbres feitos com osciladores,
 * filtro e ruído, sem amostras gravadas:
 * - baixo: dente de serra + senoide uma oitava abaixo, passa-baixa que fecha (som de dedo/palheta);
 * - violão: triângulo + dente de serra com filtro que fecha rápido; num acorde, as cordas em leve "rasgueado";
 * - teclado: dois triângulos levemente desafinados com sustentação (piano elétrico);
 * - sintetizador (lead): dois dentes de serra desafinados com filtro aberto;
 * - bateria: bumbo (senoide que cai de altura), caixa e palmas (ruído + tom), chimbal e prato (ruído agudo), tons.
 */
import type { IdInstrumento } from "@/react-app/utils/musica/instrumentos";
import type { Timbre } from "@/react-app/utils/musica/estudio";
import { frequencia } from "@/react-app/utils/musica/sintese";
import { variante } from "@/react-app/utils/musica/ferramentas";

interface Preset {
  osc: Array<{ tipo: OscillatorType; mult: number; nivel: number; desafino?: number }>;
  /** Passa-baixa: começa em f·de e fecha para f·para em `tempo` s (limites em Hz). */
  filtro: { de: number; para: number; tempo: number; q?: number; max?: number; min?: number };
  /** Envelope: ataque, pico, quanto tempo leva para cair (decai) até `sustenta`, e o soltar. */
  env: { ataque: number; pico: number; decai?: number; sustenta: number; solta: number };
  vibrato?: { hz: number; cents: number; atraso: number };
  estalo?: { hz: number; nivel: number; dura: number };
  distorcao?: number;
}

/** v8: os timbres de cada instrumento (`timbre:variação`). */
const PRESETS: Record<string, Preset> = {
  "baixo:dedo": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.45 }, { tipo: "sine", mult: 0.5, nivel: 0.55 }, { tipo: "sine", mult: 1, nivel: 0.4 }], filtro: { de: 14, para: 3, tempo: 0.25, q: 2, max: 2400, min: 160 }, env: { ataque: 0.006, pico: 0.42, sustenta: 0.26, solta: 0.12 } },
  "baixo:palheta": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.6 }, { tipo: "square", mult: 1, nivel: 0.2 }, { tipo: "sine", mult: 0.5, nivel: 0.4 }], filtro: { de: 30, para: 5, tempo: 0.15, q: 3, max: 5000, min: 300 }, env: { ataque: 0.002, pico: 0.45, sustenta: 0.22, solta: 0.1 }, estalo: { hz: 2500, nivel: 0.15, dura: 0.015 } },
  "baixo:slap": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.5 }, { tipo: "square", mult: 1, nivel: 0.3 }, { tipo: "sine", mult: 0.5, nivel: 0.5 }], filtro: { de: 40, para: 4, tempo: 0.08, q: 5, max: 7000, min: 250 }, env: { ataque: 0.001, pico: 0.55, decai: 0.12, sustenta: 0.2, solta: 0.1 }, estalo: { hz: 3200, nivel: 0.35, dura: 0.02 } },
  "baixo:fretless": { osc: [{ tipo: "sine", mult: 1, nivel: 0.6 }, { tipo: "triangle", mult: 1, nivel: 0.4 }, { tipo: "sine", mult: 0.5, nivel: 0.5 }], filtro: { de: 8, para: 4, tempo: 0.5, max: 3000, min: 200 }, env: { ataque: 0.03, pico: 0.38, sustenta: 0.3, solta: 0.2 }, vibrato: { hz: 5, cents: 12, atraso: 0.25 } },
  "baixo:synth": { osc: [{ tipo: "square", mult: 1, nivel: 0.4 }, { tipo: "sawtooth", mult: 1, nivel: 0.3, desafino: 7 }, { tipo: "sine", mult: 0.5, nivel: 0.6 }], filtro: { de: 20, para: 2, tempo: 0.3, q: 8, max: 3000, min: 200 }, env: { ataque: 0.005, pico: 0.4, sustenta: 0.3, solta: 0.1 } },
  "teclado:eletrico": { osc: [{ tipo: "triangle", mult: 1, nivel: 0.5, desafino: -5 }, { tipo: "triangle", mult: 1, nivel: 0.5, desafino: 5 }, { tipo: "sine", mult: 2, nivel: 0.12 }], filtro: { de: 8, para: 8, tempo: 0, max: 9000 }, env: { ataque: 0.01, pico: 0.22, sustenta: 0.14, solta: 0.35 } },
  "teclado:piano": { osc: [{ tipo: "triangle", mult: 1, nivel: 0.5 }, { tipo: "sawtooth", mult: 1, nivel: 0.15 }, { tipo: "sine", mult: 2, nivel: 0.2 }, { tipo: "sine", mult: 3, nivel: 0.08 }], filtro: { de: 16, para: 4, tempo: 1.2, max: 8000, min: 800 }, env: { ataque: 0.003, pico: 0.3, decai: 1.5, sustenta: 0.03, solta: 0.3 } },
  "teclado:orgao": { osc: [{ tipo: "sine", mult: 1, nivel: 0.5 }, { tipo: "sine", mult: 2, nivel: 0.35 }, { tipo: "sine", mult: 3, nivel: 0.2 }, { tipo: "sine", mult: 4, nivel: 0.12 }, { tipo: "sine", mult: 0.5, nivel: 0.3 }], filtro: { de: 12, para: 12, tempo: 0, max: 10000 }, env: { ataque: 0.01, pico: 0.16, decai: 0.05, sustenta: 0.16, solta: 0.08 }, vibrato: { hz: 6, cents: 6, atraso: 0 } },
  "violao:aco": { osc: [{ tipo: "triangle", mult: 1, nivel: 0.7 }, { tipo: "sawtooth", mult: 1, nivel: 0.25 }], filtro: { de: 12, para: 2, tempo: 0.6, max: 8000, min: 300 }, env: { ataque: 0.004, pico: 0.18, sustenta: 0.05, solta: 0.4 } },
  "violao:nylon": { osc: [{ tipo: "triangle", mult: 1, nivel: 0.8 }, { tipo: "sine", mult: 2, nivel: 0.15 }], filtro: { de: 8, para: 2, tempo: 0.8, max: 4000, min: 300 }, env: { ataque: 0.006, pico: 0.2, decai: 0.6, sustenta: 0.04, solta: 0.5 } },
  "violao:guitarra": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.5 }, { tipo: "square", mult: 1, nivel: 0.2 }], filtro: { de: 12, para: 6, tempo: 0.5, max: 5000 }, env: { ataque: 0.004, pico: 0.16, sustenta: 0.12, solta: 0.3 } },
  "violao:distorcida": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.6 }, { tipo: "sawtooth", mult: 1, nivel: 0.4, desafino: 10 }], filtro: { de: 14, para: 14, tempo: 0, max: 4500 }, env: { ataque: 0.004, pico: 0.12, sustenta: 0.12, solta: 0.2 }, distorcao: 30 },
  "lead:serra": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.4, desafino: -8 }, { tipo: "sawtooth", mult: 1, nivel: 0.4, desafino: 8 }, { tipo: "square", mult: 0.5, nivel: 0.15 }], filtro: { de: 10, para: 5, tempo: 0.3, q: 4, max: 9000 }, env: { ataque: 0.02, pico: 0.16, sustenta: 0.12, solta: 0.25 } },
  "lead:quadrada": { osc: [{ tipo: "square", mult: 1, nivel: 0.5 }, { tipo: "square", mult: 1, nivel: 0.3, desafino: 6 }], filtro: { de: 8, para: 8, tempo: 0, q: 2, max: 8000 }, env: { ataque: 0.01, pico: 0.14, sustenta: 0.12, solta: 0.2 } },
  "lead:pad": { osc: [{ tipo: "sawtooth", mult: 1, nivel: 0.3, desafino: -12 }, { tipo: "sawtooth", mult: 1, nivel: 0.3 }, { tipo: "sawtooth", mult: 1, nivel: 0.3, desafino: 12 }], filtro: { de: 4, para: 4, tempo: 0, max: 4000 }, env: { ataque: 0.4, pico: 0.12, decai: 0.2, sustenta: 0.12, solta: 1.2 } },
  "lead:sino": { osc: [{ tipo: "sine", mult: 1, nivel: 0.5 }, { tipo: "sine", mult: 2.76, nivel: 0.25 }, { tipo: "sine", mult: 5.4, nivel: 0.12 }], filtro: { de: 20, para: 20, tempo: 0, max: 12000 }, env: { ataque: 0.002, pico: 0.25, decai: 1.5, sustenta: 0.002, solta: 1 } },
};

/** Curva de saturação (tanh) para a guitarra distorcida. */
function curvaDistorcao(k: number): Float32Array<ArrayBuffer> {
  const n = 1024, c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}

interface Voz { fontes: AudioScheduledSourceNode[]; ganho: GainNode; solta: number }

/** O timbre de cada instrumento do player (o baixo de 4 e o de 5 cordas soam igual). */
export const timbreDoInstrumento = (id: IdInstrumento): Timbre => (id === "baixo4" || id === "baixo5" ? "baixo" : id);

export class Sintetizador {
  private readonly saida: GainNode;
  private vozes = new Set<Voz>();
  private ruido: AudioBuffer | null = null;

  constructor(private readonly ctx: BaseAudioContext, destino: AudioNode = ctx.destination) {
    this.saida = ctx.createGain();
    this.saida.gain.value = 0.6;
    // um compressor evita estourar quando acordes, bateria e a música somam
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.saida.connect(comp).connect(destino);
  }

  get contexto() { return this.ctx; }
  /** Onde as faixas do estúdio ligam o ganho delas. */
  get entrada(): AudioNode { return this.saida; }

  set volume(v: number) { this.saida.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), this.ctx.currentTime, 0.02); }

  /** Toca a nota `midi` daqui a `daqui` s, por `dura` s. `indice` espalha o rasgueado do violão. */
  tocar(t: Timbre | IdInstrumento, midi: number, daqui: number, dura: number, indice = 0, vel = 0.85, destino?: AudioNode, variante?: string) {
    const timbre = t === "baixo4" || t === "baixo5" ? "baixo" : (t as Timbre);
    const t0 = this.ctx.currentTime + Math.max(0, daqui) + (timbre === "violao" ? indice * 0.014 : 0);
    this.voz(timbre, midi, t0, dura, vel, destino, variante);
  }

  /** Toca no instante `t0` do relógio do contexto (o estúdio agenda assim). */
  tocarEm(timbre: Timbre, midi: number, t0: number, dura: number, vel = 0.85, destino?: AudioNode, variante?: string) {
    this.voz(timbre, midi, Math.max(this.ctx.currentTime, t0), dura, vel, destino, variante);
  }

  /** Nota segurada ao vivo (instrumento online): soa até chamar a função devolvida. */
  iniciar(timbre: Timbre, midi: number, vel = 0.85, destino?: AudioNode, variante?: string): () => void {
    const t0 = this.ctx.currentTime + 0.005;
    if (timbre === "bateria") { this.voz(timbre, midi, t0, 0.3, vel, destino, variante); return () => undefined; }
    const voz = this.voz(timbre, midi, t0, 30, vel, destino, variante);
    let solto = false;
    return () => {
      if (solto || !voz) return;
      solto = true;
      const agora = this.ctx.currentTime;
      voz.ganho.gain.cancelScheduledValues(agora);
      voz.ganho.gain.setValueAtTime(Math.max(0.0001, voz.ganho.gain.value), agora);
      voz.ganho.gain.exponentialRampToValueAtTime(0.0001, agora + voz.solta);
      for (const f of voz.fontes) { try { f.stop(agora + voz.solta + 0.05); } catch { /* já parado */ } }
    };
  }

  private ruidoBranco(): AudioBuffer {
    if (!this.ruido) {
      const n = Math.floor(this.ctx.sampleRate * 1.5);
      this.ruido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.ruido.getChannelData(0);
      // ruído determinístico (o mesmo a cada vez), para a exportação sair igual
      let s = 12345;
      for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    }
    return this.ruido;
  }

  private registrar(fontes: AudioScheduledSourceNode[], ganho: GainNode, solta: number): Voz {
    const voz: Voz = { fontes, ganho, solta };
    this.vozes.add(voz);
    fontes[0].onended = () => { ganho.disconnect(); this.vozes.delete(voz); };
    return voz;
  }

  private voz(timbre: Timbre, midi: number, t0: number, dura: number, vel: number, destino?: AudioNode, varianteId?: string): Voz | null {
    if (timbre === "bateria") return this.tambor(midi, t0, vel, destino, variante("bateria", varianteId));
    const ctx = this.ctx;
    const f = frequencia(midi);
    const v = Math.max(0.1, Math.min(1, vel));
    const p = PRESETS[`${timbre}:${variante(timbre, varianteId)}`] ?? PRESETS[`${timbre}:${variante(timbre, null)}`];
    const ganho = ctx.createGain();
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.Q.value = p.filtro.q ?? 1;
    filtro.connect(ganho).connect(destino ?? this.saida);
    // distorção (guitarra): os osciladores passam por uma curva antes do filtro
    let mistura: AudioNode = filtro;
    if (p.distorcao) {
      const sh = ctx.createWaveShaper();
      sh.curve = curvaDistorcao(p.distorcao);
      sh.oversample = "2x";
      sh.connect(filtro);
      mistura = sh;
    }
    const fontes: AudioScheduledSourceNode[] = [];
    const oscs: OscillatorNode[] = [];
    for (const o of p.osc) {
      const osc = ctx.createOscillator();
      osc.type = o.tipo;
      osc.frequency.value = f * o.mult;
      osc.detune.value = o.desafino ?? 0;
      const g = ctx.createGain();
      g.gain.value = o.nivel;
      osc.connect(g).connect(mistura);
      fontes.push(osc);
      oscs.push(osc);
    }
    // vibrato (fretless, órgão): um oscilador lento mexendo na afinação de todos
    if (p.vibrato) {
      const lfo = ctx.createOscillator(), prof = ctx.createGain();
      lfo.frequency.value = p.vibrato.hz;
      prof.gain.setValueAtTime(0, t0);
      prof.gain.linearRampToValueAtTime(p.vibrato.cents, t0 + p.vibrato.atraso + 0.2);
      lfo.connect(prof);
      for (const o of oscs) prof.connect(o.detune);
      fontes.push(lfo);
    }
    // estalo no ataque (palheta, slap)
    if (p.estalo) {
      const s = ctx.createBufferSource();
      s.buffer = this.ruidoBranco();
      const fl = ctx.createBiquadFilter();
      fl.type = "bandpass"; fl.frequency.value = p.estalo.hz; fl.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.estalo.nivel * v, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.estalo.dura);
      s.connect(fl).connect(g).connect(destino ?? this.saida);
      s.start(t0); s.stop(t0 + p.estalo.dura + 0.02);
      fontes.push(s);
    }
    const fl = p.filtro;
    const fIni = Math.min(fl.max ?? 12000, f * fl.de), fFim = Math.max(fl.min ?? 80, Math.min(fIni, f * fl.para));
    filtro.frequency.setValueAtTime(fIni, t0);
    if (fl.tempo > 0 && fFim < fIni) filtro.frequency.exponentialRampToValueAtTime(fFim, t0 + fl.tempo);
    const e = p.env;
    const pico = e.pico * v, sustenta = Math.max(0.0002, e.sustenta * v);
    const fimNota = t0 + Math.max(0.08, dura);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(pico, t0 + e.ataque);
    ganho.gain.exponentialRampToValueAtTime(sustenta, t0 + e.ataque + (e.decai ?? 0.18));
    ganho.gain.setValueAtTime(sustenta, Math.max(fimNota, t0 + e.ataque + (e.decai ?? 0.18)));
    ganho.gain.exponentialRampToValueAtTime(0.0001, Math.max(fimNota, t0 + e.ataque + (e.decai ?? 0.18)) + e.solta);
    const fim = Math.max(fimNota, t0 + e.ataque + (e.decai ?? 0.18)) + e.solta + 0.05;
    for (const o of fontes) { if (o instanceof OscillatorNode) { o.start(t0); o.stop(fim); } }
    return this.registrar(fontes, ganho, e.solta);
  }

  /** Uma batida da bateria (a "nota" diz a peça, como no General MIDI). */
  private tambor(peca: number, t0: number, vel: number, destino?: AudioNode, kit = "acustica"): Voz {
    const ctx = this.ctx;
    const v = Math.max(0.1, Math.min(1, vel));
    const ganho = ctx.createGain();
    ganho.connect(destino ?? this.saida);
    const fontes: AudioScheduledSourceNode[] = [];
    const env = (g: GainNode, pico: number, cai: number) => {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(pico * v, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + cai);
    };
    const tom = (de: number, para: number, cai: number, pico: number, tipo: OscillatorType = "sine") => {
      const o = ctx.createOscillator();
      o.type = tipo;
      o.frequency.setValueAtTime(de, t0);
      o.frequency.exponentialRampToValueAtTime(para, t0 + cai * 0.6);
      const g = ctx.createGain();
      env(g, pico, cai);
      o.connect(g).connect(ganho);
      o.start(t0); o.stop(t0 + cai + 0.05);
      fontes.push(o);
    };
    const chiado = (tipo: BiquadFilterType, freq: number, cai: number, pico: number, q = 0.8) => {
      const s = ctx.createBufferSource();
      s.buffer = this.ruidoBranco();
      const fl = ctx.createBiquadFilter();
      fl.type = tipo; fl.frequency.value = freq; fl.Q.value = q;
      const g = ctx.createGain();
      env(g, pico, cai);
      s.connect(fl).connect(g).connect(ganho);
      s.start(t0); s.stop(t0 + cai + 0.05);
      fontes.push(s);
    };
    if (kit === "eletronica") {
      // bateria eletrônica (estilo 808): bumbo longo e grave, caixa e chimbal curtos e metálicos
      switch (peca) {
        case 35: case 36: tom(110, 42, 0.9, 1.0); break;
        case 38: case 40: tom(220, 180, 0.08, 0.3, "triangle"); chiado("highpass", 2200, 0.13, 0.6); break;
        case 39: chiado("bandpass", 1600, 0.12, 0.8, 2); break;
        case 42: case 44: chiado("highpass", 9000, 0.03, 0.4, 1.5); break;
        case 46: chiado("highpass", 8500, 0.28, 0.35, 1.5); break;
        case 49: case 57: chiado("highpass", 6000, 0.9, 0.3, 0.7); break;
        case 41: case 43: tom(130, 70, 0.5, 0.8); break;
        default: tom(180, 120, 0.4, 0.7);
      }
      return this.registrar(fontes, ganho, 0.05);
    }
    switch (peca) {
      case 35: case 36: tom(150, 45, 0.45, 1.0); tom(1200, 200, 0.02, 0.25, "triangle"); break; // bumbo
      case 38: case 40: tom(240, 160, 0.12, 0.45, "triangle"); chiado("highpass", 1500, 0.2, 0.55); break; // caixa
      case 39: for (const d of [0, 0.012, 0.024]) { const s = ctx.createBufferSource(); s.buffer = this.ruidoBranco(); const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 1200; fl.Q.value = 1.5; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.6 * v, t0 + d + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + (d === 0.024 ? 0.15 : 0.01)); s.connect(fl).connect(g).connect(ganho); s.start(t0 + d); s.stop(t0 + d + 0.2); fontes.push(s); } break; // palmas
      case 42: case 44: chiado("highpass", 7000, 0.05, 0.35); break; // chimbal fechado
      case 46: chiado("highpass", 6500, 0.35, 0.3); break; // chimbal aberto
      case 49: case 57: chiado("highpass", 4500, 1.2, 0.35, 0.5); chiado("bandpass", 8000, 0.8, 0.15); break; // prato
      case 41: case 43: tom(110, 70, 0.4, 0.8); break; // surdo
      case 45: case 47: case 48: case 50: tom(200, 130, 0.3, 0.7); break; // tom
      default: tom(300, 200, 0.15, 0.5);
    }
    return this.registrar(fontes, ganho, 0.05);
  }

  /** Corta tudo que está soando ou agendado (pausa, pulo, troca de tom ou de instrumento). */
  calar() {
    const agora = this.ctx.currentTime;
    for (const v of this.vozes) {
      v.ganho.gain.cancelScheduledValues(agora);
      v.ganho.gain.setTargetAtTime(0, agora, 0.015);
      for (const o of v.fontes) { try { o.stop(agora + 0.08); } catch { /* ainda não começou: o stop vale igual */ } }
    }
    this.vozes.clear();
  }

  fechar() {
    this.calar();
    this.saida.disconnect();
  }
}
