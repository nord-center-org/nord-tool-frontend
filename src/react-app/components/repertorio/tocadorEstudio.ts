/**
 * Repertório v6 — o tocador do estúdio ("Criar"): toca as faixas do projeto no relógio do Web Audio (agenda um
 * pouco à frente, como o sintetizador do player), com metrônomo, repetição, contagem de um compasso antes de gravar
 * e a mixagem offline para exportar em WAV. Cada faixa tem o próprio ganho (volume); mudo e solo valem na hora.
 */
import { Sintetizador } from "@/react-app/components/repertorio/sintetizador";
import {
  TEMPOS_POR_COMPASSO, faixasAudiveis, notasNoIntervalo, segundosPorTempo, temposDoProjeto, type Projeto,
} from "@/react-app/utils/musica/estudio";
import { intercalar, wav16 } from "@/react-app/utils/musica/separacao";

/** Quanto à frente (s) as notas são agendadas, e de quanto em quanto tempo (ms) o agendador acorda. */
const ANTECEDENCIA = 0.12, PASSO_MS = 25;

export class TocadorEstudio {
  readonly ctx: AudioContext;
  readonly sint: Sintetizador;
  private ganhos = new Map<string, GainNode>();
  private projeto: Projeto;
  private timer = 0;
  /** Instante do relógio em que o tempo `origem` tocou. */
  private t0 = 0;
  private origem = 0;
  private agendadoAte = 0;
  private spb = 0.6;
  tocando = false;
  laco = false;
  metronomo = true;
  /** Avisado quando para sozinho (fim da música). */
  aoParar?: () => void;

  constructor(projeto: Projeto) {
    this.ctx = new AudioContext();
    this.sint = new Sintetizador(this.ctx);
    this.projeto = projeto;
    this.atualizar(projeto);
  }

  /** O projeto mudou (nota, volume, BPM…): o que ainda não foi agendado já sai com a mudança. */
  atualizar(p: Projeto) {
    const bpmMudou = p.bpm !== this.projeto.bpm;
    const pos = this.posicao();
    this.projeto = p;
    for (const f of p.faixas) {
      let g = this.ganhos.get(f.id);
      if (!g) { g = this.ctx.createGain(); g.connect(this.sint.entrada); this.ganhos.set(f.id, g); }
      g.gain.setTargetAtTime(f.volume, this.ctx.currentTime, 0.02);
    }
    for (const [id, g] of this.ganhos) if (!p.faixas.some(f => f.id === id)) { g.disconnect(); this.ganhos.delete(id); }
    // faixa calada (mudo/solo) para de soar na hora
    const audiveis = new Set(faixasAudiveis(p.faixas).map(f => f.id));
    for (const f of p.faixas) this.ganhos.get(f.id)!.gain.setTargetAtTime(audiveis.has(f.id) ? f.volume : 0, this.ctx.currentTime, 0.01);
    if (bpmMudou && this.tocando) this.tocar(Math.max(0, pos));
  }

  ganhoDaFaixa(id: string): AudioNode | undefined { return this.ganhos.get(id); }

  /** Tempo (em tempos) que está tocando; negativo durante a contagem. Com repetição, sempre dentro da música. */
  posicao(): number {
    if (!this.tocando) return this.origem;
    const bruto = this.origem + (this.ctx.currentTime - this.t0) / this.spb;
    const total = temposDoProjeto(this.projeto);
    return this.laco && bruto >= 0 ? bruto % total : bruto;
  }

  /** Tempo sem dar a volta (para a gravação saber onde cada nota caiu). */
  tempoNoRelogio(instante: number): number {
    return this.origem + (instante - this.t0) / this.spb;
  }

  /** Começa a tocar em `de` (tempos). `contagem` toca um compasso de metrônomo antes. */
  async tocar(de = 0, contagem = false) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    window.clearInterval(this.timer);
    this.sint.calar();
    this.spb = segundosPorTempo(this.projeto.bpm);
    this.origem = de - (contagem ? TEMPOS_POR_COMPASSO : 0);
    this.t0 = this.ctx.currentTime + 0.06;
    this.agendadoAte = this.origem;
    this.tocando = true;
    this.agendar();
    this.timer = window.setInterval(() => this.agendar(), PASSO_MS);
  }

  parar(de?: number) {
    window.clearInterval(this.timer);
    const pos = this.posicao();
    this.tocando = false;
    this.origem = de ?? Math.max(0, pos);
    this.sint.calar();
  }

  private agendar() {
    const p = this.projeto, total = temposDoProjeto(p);
    const agora = this.ctx.currentTime;
    const ate = this.origem + (agora + ANTECEDENCIA - this.t0) / this.spb;
    if (!this.laco && this.agendadoAte >= total) {
      if (this.origem + (agora - this.t0) / this.spb >= total + 0.05) { this.parar(0); this.aoParar?.(); }
      return;
    }
    const limite = this.laco ? ate : Math.min(ate, total);
    if (limite <= this.agendadoAte) return;
    const quando = (tempo: number) => this.t0 + (tempo - this.origem) * this.spb;
    for (const { faixa, nota, tempo } of notasNoIntervalo(p, Math.max(0, this.agendadoAte), limite, this.laco)) {
      this.sint.tocarEm(faixa.timbre, nota.midi, quando(tempo), nota.dur * this.spb, nota.vel, this.ganhos.get(faixa.id), faixa.variante);
    }
    if (this.metronomo || this.agendadoAte < 0) {
      for (let b = Math.ceil(this.agendadoAte - 1e-9); b < limite; b++) {
        if (b < this.agendadoAte - 1e-9) continue;
        // durante a contagem o metrônomo toca sempre; depois, só se ligado
        if (b >= 0 && !this.metronomo) continue;
        this.clique(quando(b), ((b % TEMPOS_POR_COMPASSO) + TEMPOS_POR_COMPASSO) % TEMPOS_POR_COMPASSO === 0);
      }
    }
    this.agendadoAte = limite;
  }

  private clique(t: number, forte: boolean) {
    if (t < this.ctx.currentTime) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = forte ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(forte ? 0.35 : 0.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.06);
  }

  fechar() {
    this.parar();
    this.sint.fechar();
    void this.ctx.close();
  }
}

/** Mixa o projeto inteiro offline e devolve um WAV estéreo de 16 bits (com 1,5 s de cauda para o som morrer). */
export async function renderizarProjeto(p: Projeto, sr = 44100): Promise<Blob> {
  const spb = segundosPorTempo(p.bpm);
  const duracao = temposDoProjeto(p) * spb + 1.5;
  const off = new OfflineAudioContext(2, Math.ceil(duracao * sr), sr);
  const sint = new Sintetizador(off);
  const ganhos = new Map<string, GainNode>();
  for (const f of faixasAudiveis(p.faixas)) { const g = off.createGain(); g.gain.value = f.volume; g.connect(sint.entrada); ganhos.set(f.id, g); }
  for (const { faixa, nota, tempo } of notasNoIntervalo(p, 0, temposDoProjeto(p))) {
    sint.tocarEm(faixa.timbre, nota.midi, tempo * spb, nota.dur * spb, nota.vel, ganhos.get(faixa.id), faixa.variante);
  }
  const r = await off.startRendering();
  const L = r.getChannelData(0), R = r.numberOfChannels > 1 ? r.getChannelData(1) : L;
  return new Blob([wav16(intercalar(L, R), sr)], { type: "audio/wav" });
}
