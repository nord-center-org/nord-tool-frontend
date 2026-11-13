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
  tocar(t: Timbre | IdInstrumento, midi: number, daqui: number, dura: number, indice = 0, vel = 0.85, destino?: AudioNode) {
    const timbre = t === "baixo4" || t === "baixo5" ? "baixo" : (t as Timbre);
    const t0 = this.ctx.currentTime + Math.max(0, daqui) + (timbre === "violao" ? indice * 0.014 : 0);
    this.voz(timbre, midi, t0, dura, vel, destino);
  }

  /** Toca no instante `t0` do relógio do contexto (o estúdio agenda assim). */
  tocarEm(timbre: Timbre, midi: number, t0: number, dura: number, vel = 0.85, destino?: AudioNode) {
    this.voz(timbre, midi, Math.max(this.ctx.currentTime, t0), dura, vel, destino);
  }

  /** Nota segurada ao vivo (instrumento online): soa até chamar a função devolvida. */
  iniciar(timbre: Timbre, midi: number, vel = 0.85, destino?: AudioNode): () => void {
    const t0 = this.ctx.currentTime + 0.005;
    if (timbre === "bateria") { this.voz(timbre, midi, t0, 0.3, vel, destino); return () => undefined; }
    const voz = this.voz(timbre, midi, t0, 30, vel, destino);
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

  private voz(timbre: Timbre, midi: number, t0: number, dura: number, vel: number, destino?: AudioNode): Voz | null {
    if (timbre === "bateria") return this.tambor(midi, t0, vel, destino);
    const ctx = this.ctx;
    const f = frequencia(midi);
    const v = Math.max(0.1, Math.min(1, vel));
    const ganho = ctx.createGain();
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.connect(ganho).connect(destino ?? this.saida);
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
    if (timbre === "teclado") {
      osc("triangle", f, 0.5, -5); osc("triangle", f, 0.5, 5); osc("sine", f * 2, 0.12);
      filtro.frequency.value = Math.min(9000, f * 8);
      ataque = 0.01; pico = 0.22; sustenta = 0.14; solta = 0.35;
    } else if (timbre === "violao") {
      osc("triangle", f, 0.7); osc("sawtooth", f, 0.25);
      filtro.frequency.setValueAtTime(Math.min(8000, f * 12), t0);
      filtro.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t0 + 0.6);
      ataque = 0.004; pico = 0.18; sustenta = 0.05; solta = 0.4;
    } else if (timbre === "lead") {
      osc("sawtooth", f, 0.4, -8); osc("sawtooth", f, 0.4, 8); osc("square", f / 2, 0.15);
      filtro.Q.value = 4;
      filtro.frequency.setValueAtTime(Math.min(9000, f * 10), t0);
      filtro.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 5), t0 + 0.3);
      ataque = 0.02; pico = 0.16; sustenta = 0.12; solta = 0.25;
    } else {
      osc("sawtooth", f, 0.45); osc("sine", f / 2, 0.55); osc("sine", f, 0.4);
      filtro.Q.value = 2;
      filtro.frequency.setValueAtTime(Math.min(2400, f * 14), t0);
      filtro.frequency.exponentialRampToValueAtTime(Math.max(160, f * 3), t0 + 0.25);
      ataque = 0.006; pico = 0.42; sustenta = 0.26; solta = 0.12;
    }
    pico *= v; sustenta *= v;
    const fimNota = t0 + Math.max(0.08, dura);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
    ganho.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustenta), t0 + ataque + 0.18);
    ganho.gain.setValueAtTime(Math.max(0.0002, sustenta), fimNota);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fimNota + solta);
    for (const o of fontes) { o.start(t0); o.stop(fimNota + solta + 0.05); }
    return this.registrar(fontes, ganho, solta);
  }

  /** Uma batida da bateria (a "nota" diz a peça, como no General MIDI). */
  private tambor(peca: number, t0: number, vel: number, destino?: AudioNode): Voz {
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
