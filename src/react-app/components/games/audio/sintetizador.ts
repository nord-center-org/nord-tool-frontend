/**
 * Sintetizador dos jogos (Web Audio): nenhum arquivo de som. Efeitos 8/16-bit com osciladores, ruído e filtros, e uma
 * trilha de batida simples que acelera nos segundos finais. Só começa a tocar depois de um toque/tecla (regra dos navegadores).
 */
type Onda = OscillatorType;

class Sintetizador {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private musica: { parar: () => void; bpm: number; definirBpm: (b: number) => void } | null = null;
  mudo = false;

  private iniciar(): AudioContext | null {
    if (this.mudo) return null;
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.mestre = this.ctx.createGain();
      this.mestre.gain.value = 0.35;
      const comp = this.ctx.createDynamicsCompressor();
      this.mestre.connect(comp).connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.ruido = this.ctx.createBuffer(1, n, n);
      const d = this.ruido.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Chamado num toque ou tecla: libera o áudio no navegador. */
  destravar() {
    this.iniciar();
  }

  definirMudo(m: boolean) {
    this.mudo = m;
    if (m) this.pararMusica();
  }

  private tom(freq: number, dur: number, onda: Onda = "square", vol = 0.3, ate?: number, atraso = 0) {
    const c = this.iniciar();
    if (!c || !this.mestre) return;
    const t = c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = onda;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private chiado(dur: number, vol = 0.4, filtro = 1200, tipo: BiquadFilterType = "lowpass", ateFiltro?: number, atraso = 0) {
    const c = this.iniciar();
    if (!c || !this.mestre || !this.ruido) return;
    const t = c.currentTime + atraso;
    const s = c.createBufferSource();
    s.buffer = this.ruido;
    const f = c.createBiquadFilter();
    f.type = tipo;
    f.frequency.setValueAtTime(filtro, t);
    if (ateFiltro) f.frequency.exponentialRampToValueAtTime(ateFiltro, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---- efeitos
  explosao(forca = 1) {
    this.chiado(0.5 + forca * 0.15, 0.55, 2400, "lowpass", 90);
    this.tom(110, 0.35, "sawtooth", 0.25, 32);
  }
  colocar() { this.tom(220, 0.08, "square", 0.18, 110); }
  powerup() { [523, 659, 784, 1047].forEach((f, i) => this.tom(f, 0.09, "square", 0.16, undefined, i * 0.055)); }
  maldicao() { [400, 300, 220].forEach((f, i) => this.tom(f, 0.14, "sawtooth", 0.15, f * 0.8, i * 0.09)); }
  moeda() { this.tom(988, 0.06, "square", 0.15); this.tom(1319, 0.18, "square", 0.15, undefined, 0.06); }
  morte() { this.tom(660, 0.6, "triangle", 0.3, 80); this.chiado(0.3, 0.2, 800); }
  escudo() { this.tom(880, 0.25, "sine", 0.25, 1760); }
  chute() { this.tom(160, 0.07, "square", 0.2, 320); this.chiado(0.08, 0.2, 3000, "highpass"); }
  arremesso() { this.tom(300, 0.25, "triangle", 0.2, 900); }
  bloco() { this.tom(90, 0.12, "square", 0.25, 50); this.chiado(0.1, 0.25, 600); }
  clique() { this.tom(700, 0.04, "square", 0.1); }
  contagem(final = false) { this.tom(final ? 1046 : 523, final ? 0.4 : 0.15, "square", 0.22); }
  alerta() { this.tom(880, 0.12, "square", 0.2); this.tom(660, 0.12, "square", 0.2, undefined, 0.14); }
  vitoria() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tom(f, i === 5 ? 0.6 : 0.14, "square", 0.2, undefined, i * 0.13)); }

  // ---- notas avulsas (o jogo de ritmo toca a própria música no compasso das notas).
  /** Uma nota musical (frequência em Hz) agora ou daqui a {@code atraso} segundos. */
  nota(freq: number, dur = 0.2, onda: Onda = "triangle", vol = 0.2, atraso = 0) { this.tom(freq, dur, onda, vol, undefined, atraso); }
  /** Bateria: bumbo, caixa ou chimbal. */
  bateria(peca: "bumbo" | "caixa" | "chimbal", atraso = 0) {
    if (peca === "bumbo") this.tom(120, 0.12, "sine", 0.4, 45, atraso);
    else if (peca === "caixa") this.chiado(0.1, 0.22, 1800, "bandpass", undefined, atraso);
    else this.chiado(0.03, 0.07, 8000, "highpass", undefined, atraso);
  }

  // ---- trilha: baixo + caixa + chimbal num loop de 16 tempos, com o BPM ajustável (acelera no fim da partida).
  tocarMusica(bpm = 132, escala = [0, 3, 5, 7, 10]) {
    this.pararMusica();
    const c = this.iniciar();
    if (!c) return;
    let passo = 0;
    let atual = bpm;
    let proximo = c.currentTime + 0.05;
    const raiz = 55;
    const padrao = [0, 0, 2, 0, 3, 0, 2, 4, 0, 0, 2, 0, 4, 3, 2, 1];
    const timer = window.setInterval(() => {
      if (!this.ctx) return;
      while (proximo < this.ctx.currentTime + 0.12) {
        const tempo = proximo - this.ctx.currentTime;
        const nota = raiz * 2 ** (escala[padrao[passo % 16] % escala.length] / 12);
        if (passo % 2 === 0) this.tom(nota, 0.16, "triangle", 0.22, undefined, tempo);
        if (passo % 4 === 2) this.chiado(0.09, 0.18, 1800, "bandpass", undefined, tempo);
        if (passo % 4 === 0) this.tom(120, 0.1, "sine", 0.35, 45, tempo);
        this.chiado(0.025, 0.06, 8000, "highpass", undefined, tempo);
        if (passo % 8 === 6) this.tom(nota * 4, 0.1, "square", 0.05, undefined, tempo);
        proximo += 60 / atual / 4;
        passo++;
      }
    }, 25);
    this.musica = { parar: () => window.clearInterval(timer), bpm, definirBpm: b => { atual = b; } };
  }

  acelerarMusica(bpm: number) {
    this.musica?.definirBpm(bpm);
  }

  pararMusica() {
    this.musica?.parar();
    this.musica = null;
  }
}

export const som = new Sintetizador();
