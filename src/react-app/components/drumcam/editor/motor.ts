import { FILTRO_NEUTRO } from "@/react-app/utils/drumcamAoVivo";
import {
  camadasNoTempo, dbParaLinear, duracaoEditada, ganhosNoTempo, iniciosEditados, paraEditado, paraFonte, quebrarLinhas, textosNoTempo, transicaoNoTempo,
  type Melhoria, type ProjetoEdicao, type TextoEdicao,
} from "@/react-app/utils/editorVideo";
import { Compositor } from "../compositor";

export interface FonteEdicao { camera: string; blob: Blob; /** Segundo do arquivo que é o 0 da gravação. */ inicio: number }

/**
 * Motor do editor de vídeo: toca as câmeras juntas (cada uma no seu arquivo), seguindo os cortes do projeto; a cada
 * passo põe o layout, os ganhos (com os destaques) e os textos do instante; e grava o vídeo final na exportação.
 * O áudio passa pelo tratamento (filtros, equalizador, compressor, ganho e limitador) antes de sair.
 */
export class MotorEdicao {
  readonly comp: Compositor;
  private videos = new Map<string, { el: HTMLVideoElement; inicio: number; url: string }>();
  private externo: { el: HTMLAudioElement; ganho: GainNode; url: string; faixaId: string } | null = null;
  private cadeia: {
    ronco: BiquadFilterNode; chiado: BiquadFilterNode; graves: BiquadFilterNode; medios: BiquadFilterNode; agudos: BiquadFilterNode;
    compressor: DynamicsCompressorNode; ganho: GainNode; limitador: DynamicsCompressorNode;
  };
  private p: ProjetoEdicao;
  private indice = 0;
  private tEditado = 0;
  private pulando = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private ouvintes = new Set<(t: number, tocando: boolean) => void>();
  tocando = false;
  private fimDaExportacao: (() => void) | null = null;

  constructor(projeto: ProjetoEdicao) {
    this.p = projeto;
    this.comp = new Compositor(projeto.formato);
    const a = this.comp.audio;
    const filtro = (tipo: BiquadFilterType, f: number) => { const n = a.createBiquadFilter(); n.type = tipo; n.frequency.value = f; return n; };
    this.cadeia = {
      ronco: filtro("highpass", 20), chiado: filtro("lowpass", 20000),
      graves: filtro("lowshelf", 180), medios: filtro("peaking", 1000), agudos: filtro("highshelf", 6000),
      compressor: a.createDynamicsCompressor(), ganho: a.createGain(), limitador: a.createDynamicsCompressor(),
    };
    const c = this.cadeia;
    c.medios.Q.value = 0.8;
    c.limitador.threshold.value = -1; c.limitador.knee.value = 0; c.limitador.ratio.value = 20; c.limitador.attack.value = 0.002; c.limitador.release.value = 0.1;
    c.ronco.connect(c.chiado).connect(c.graves).connect(c.medios).connect(c.agudos).connect(c.compressor).connect(c.ganho).connect(c.limitador);
    this.comp.cadeiaMestre(c.ronco, c.limitador);
    this.comp.ouvir(true);
    this.comp.sobreposicao = (ctx, w, h) => this.desenharSobre(ctx, w, h);
    this.aplicarMelhoria(projeto.melhoria);
  }

  /** Abre o arquivo de cada câmera. */
  async carregar(fontes: FonteEdicao[]) {
    await Promise.all(fontes.map(async f => {
      const el = document.createElement("video");
      const url = URL.createObjectURL(f.blob);
      el.src = url; el.playsInline = true; el.preload = "auto"; el.crossOrigin = "anonymous";
      await new Promise<void>((ok, erro) => { el.onloadeddata = () => ok(); el.onerror = () => erro(new Error("Um dos vídeos não abriu neste navegador.")); });
      this.videos.set(f.camera, { el, inicio: f.inicio, url });
      const camada = this.p.camadasBase.find(c => c.id === f.camera) ?? { id: f.camera, x: 0, y: 0, w: 1, h: 1, z: 0, ajuste: "cobrir" as const, raio: 0, visivel: true, espelhar: false };
      this.comp.fonte(f.camera, el, camada, el);
    }));
    this.aplicar();
    this.timer = setInterval(() => this.passo(), 1000 / 30);
    await this.irPara(0);
  }

  /** Duração de cada arquivo, já descontado o começo (para a duração da gravação quando o item não tem). */
  duracaoDasFontes(): number {
    return Math.max(0, ...[...this.videos.values()].map(v => (Number.isFinite(v.el.duration) ? v.el.duration - v.inicio : 0)));
  }

  ouvir(f: (t: number, tocando: boolean) => void) { this.ouvintes.add(f); return () => { this.ouvintes.delete(f); }; }
  private avisar() { for (const f of this.ouvintes) f(this.tEditado, this.tocando); }

  get tempo() { return this.tEditado; }

  /** Projeto mudou (o editor chama a cada mexida). */
  atualizar(p: ProjetoEdicao) {
    const formatoMudou = p.formato !== this.p.formato;
    const melhoriaMudou = p.melhoria !== this.p.melhoria;
    const cortesMudaram = p.cortes !== this.p.cortes;
    this.p = p;
    if (formatoMudou) this.comp.redimensionar(p.formato);
    if (melhoriaMudou) this.aplicarMelhoria(p.melhoria);
    if (this.externo) this.externo.ganho.gain.value = dbParaLinear(p.externo?.ganhoDb ?? 0);
    if (cortesMudaram) {
      this.tEditado = Math.min(this.tEditado, duracaoEditada(p.cortes));
      if (!this.tocando) void this.irPara(this.tEditado);
    }
    this.aplicar();
  }

  private aplicarMelhoria(m: Melhoria) {
    const c = this.cadeia, t = this.comp.audio.currentTime;
    c.ronco.frequency.setTargetAtTime(m.tirarRonco ? 80 : 20, t, 0.05);
    c.chiado.frequency.setTargetAtTime(m.tirarChiado ? 12000 : 20000, t, 0.05);
    c.graves.gain.setTargetAtTime(m.graves, t, 0.05);
    c.medios.gain.setTargetAtTime(m.medios, t, 0.05);
    c.agudos.gain.setTargetAtTime(m.agudos, t, 0.05);
    c.compressor.threshold.value = m.nivelar ? -24 : 0;
    c.compressor.ratio.value = m.nivelar ? 4 : 1;
    c.compressor.knee.value = m.nivelar ? 12 : 0;
    // Compensa o volume que o compressor tira.
    c.ganho.gain.setTargetAtTime(dbParaLinear(m.ganhoDb + (m.nivelar ? 6 : 0)), t, 0.05);
  }

  /** Liga (ou troca) o áudio externo importado. */
  async ligarExterno(faixaId: string, blob: Blob | null) {
    if (this.externo?.faixaId === faixaId) return;
    this.desligarExterno();
    if (!blob) return;
    const el = document.createElement("audio");
    const url = URL.createObjectURL(blob);
    el.src = url; el.preload = "auto";
    await new Promise<void>((ok, erro) => { el.onloadeddata = () => ok(); el.onerror = () => erro(new Error("O áudio importado não abriu neste navegador.")); });
    const ganho = this.comp.audioExtra(el);
    ganho.gain.value = dbParaLinear(this.p.externo?.ganhoDb ?? 0);
    this.externo = { el, ganho, url, faixaId };
    await this.irPara(this.tEditado);
  }

  desligarExterno() {
    if (!this.externo) return;
    this.externo.el.pause();
    this.externo.ganho.disconnect();
    URL.revokeObjectURL(this.externo.url);
    this.externo = null;
  }

  /** Layout, filtros e ganhos do instante atual. */
  private aplicar() {
    const pos = paraFonte(this.p.cortes, this.tEditado);
    const tFonte = pos?.tFonte ?? 0;
    const camadas = camadasNoTempo(this.p, tFonte);
    const ganhos = ganhosNoTempo(this.p, tFonte);
    for (const [id, f] of this.comp.fontes) {
      const c = camadas.find(x => x.id === id);
      f.camada = c ?? { ...f.camada, visivel: false };
      f.filtro = this.p.filtros[id] ?? FILTRO_NEUTRO;
      this.comp.ganhoDireto(id, ganhos[id] ?? 1, this.p.canais[id]?.pan ?? 0);
    }
  }

  /** Relógio: o tempo da gravação pelo vídeo que está tocando. */
  private tempoDaFonte(): number | null {
    let melhor: number | null = null;
    for (const v of this.videos.values()) {
      if (v.el.paused || v.el.ended) continue;
      const t = v.el.currentTime - v.inicio;
      melhor = melhor === null ? t : Math.max(melhor, t);
    }
    return melhor;
  }

  private passo() {
    if (this.tocando && !this.pulando) {
      const trecho = this.p.cortes[this.indice];
      const tFonte = this.tempoDaFonte();
      if (!trecho) { this.terminar(); return; }
      if (tFonte === null || tFonte >= trecho.fim - 0.02) {
        // Fim do trecho: pula para o próximo (ou termina).
        if (this.indice + 1 >= this.p.cortes.length) { this.terminar(); return; }
        void this.pularPara(iniciosEditados(this.p.cortes)[this.indice + 1], true);
        return;
      }
      this.tEditado = iniciosEditados(this.p.cortes)[this.indice] + Math.max(0, tFonte - trecho.inicio);
      this.ressincronizar(tFonte);
    }
    this.aplicar();
    this.avisar();
  }

  /** Câmeras e áudio externo que escorregaram mais de 60 ms voltam para o lugar. */
  private ressincronizar(tFonte: number) {
    for (const v of this.videos.values()) {
      const alvo = tFonte + v.inicio;
      if (alvo > v.el.duration) { if (!v.el.paused) v.el.pause(); continue; }
      if (v.el.paused && alvo >= 0) void v.el.play().catch(() => undefined);
      if (Math.abs(v.el.currentTime - alvo) > 0.06) v.el.currentTime = alvo;
    }
    const e = this.externo, desloc = this.p.externo?.deslocamento ?? 0;
    if (e) {
      const alvo = tFonte + desloc;
      if (alvo < 0 || alvo > e.el.duration) { if (!e.el.paused) e.el.pause(); }
      else {
        if (e.el.paused) void e.el.play().catch(() => undefined);
        if (Math.abs(e.el.currentTime - alvo) > 0.06) e.el.currentTime = alvo;
      }
    }
  }

  private async posicionar(tFonte: number) {
    const esperas: Promise<void>[] = [];
    const ir = (el: HTMLMediaElement, alvo: number) => {
      const t = Math.max(0, Math.min(alvo, (el.duration || alvo) - 0.01));
      if (Math.abs(el.currentTime - t) < 0.005) return;
      esperas.push(new Promise<void>(ok => { const fim = () => { el.removeEventListener("seeked", fim); ok(); }; el.addEventListener("seeked", fim); setTimeout(fim, 1500); }));
      el.currentTime = t;
    };
    for (const v of this.videos.values()) ir(v.el, tFonte + v.inicio);
    if (this.externo) ir(this.externo.el, tFonte + (this.p.externo?.deslocamento ?? 0));
    await Promise.all(esperas);
  }

  private pausarTudo() {
    for (const v of this.videos.values()) v.el.pause();
    this.externo?.el.pause();
  }

  private async tocarTudo(tFonte: number) {
    await this.comp.audio.resume();
    const tocar = (el: HTMLMediaElement, alvo: number) => { if (alvo >= 0 && alvo < (el.duration || Infinity)) return el.play().catch(() => undefined); return undefined; };
    await Promise.all([
      ...[...this.videos.values()].map(v => tocar(v.el, tFonte + v.inicio)),
      this.externo ? tocar(this.externo.el, tFonte + (this.p.externo?.deslocamento ?? 0)) : undefined,
    ]);
  }

  private async pularPara(t: number, continuar: boolean) {
    this.pulando = true;
    this.comp.pausarGravacao();
    this.pausarTudo();
    const pos = paraFonte(this.p.cortes, t);
    if (!pos) { this.pulando = false; return; }
    this.indice = pos.indice;
    this.tEditado = Math.max(0, Math.min(t, duracaoEditada(this.p.cortes)));
    await this.posicionar(pos.tFonte);
    this.aplicar();
    if (continuar && this.tocando) await this.tocarTudo(pos.tFonte);
    this.comp.retomarGravacao();
    this.pulando = false;
    this.avisar();
  }

  /** Vai para o segundo `t` do vídeo editado (tocando ou não). */
  irPara(t: number) { return this.pularPara(t, this.tocando); }

  async tocar() {
    if (this.tocando) return;
    if (this.tEditado >= duracaoEditada(this.p.cortes) - 0.05) this.tEditado = 0;
    this.tocando = true;
    await this.pularPara(this.tEditado, true);
  }

  pausar() {
    this.tocando = false;
    this.pausarTudo();
    this.avisar();
  }

  private terminar() {
    this.pausar();
    this.tEditado = duracaoEditada(this.p.cortes);
    this.avisar();
    this.fimDaExportacao?.();
  }

  /** Grava o vídeo final do começo ao fim (leva o tempo do vídeo). */
  async exportar(progresso: (f: number) => void): Promise<Blob> {
    this.pausar();
    await this.pularPara(0, false);
    const total = duracaoEditada(this.p.cortes);
    const tirar = this.ouvir(t => progresso(Math.min(1, t / Math.max(0.1, total))));
    try {
      this.comp.gravar();
      const acabou = new Promise<void>(ok => { this.fimDaExportacao = ok; });
      await this.tocar();
      await acabou;
      return (await this.comp.parar()).blob;
    } finally {
      this.fimDaExportacao = null;
      tirar();
    }
  }

  /** Cancela a exportação no meio. */
  async cancelarExportacao() {
    this.fimDaExportacao = null;
    this.pausar();
    if (this.comp.gravando) await this.comp.parar().catch(() => undefined);
  }

  /** Textos e véu da transição por cima das câmeras. */
  private desenharSobre(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pos = paraFonte(this.p.cortes, this.tEditado);
    if (!pos) return;
    for (const t of textosNoTempo(this.p.textos, pos.tFonte)) desenharTexto(ctx, t, w, h);
    const v = transicaoNoTempo(this.p.cortes, this.p.transicoes, this.tEditado);
    if (v.alfa > 0) {
      ctx.save();
      ctx.globalAlpha = v.alfa;
      ctx.fillStyle = v.cor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /** O segundo da gravação em que o vídeo editado está. */
  tempoNaGravacao(): number { return paraFonte(this.p.cortes, this.tEditado)?.tFonte ?? 0; }
  /** Vai para o segundo da gravação (se ele não foi cortado). */
  irParaGravacao(tFonte: number) { const t = paraEditado(this.p.cortes, tFonte); if (t !== null) void this.irPara(t); }

  fechar() {
    if (this.timer) clearInterval(this.timer);
    this.pausar();
    this.desligarExterno();
    for (const v of this.videos.values()) { v.el.removeAttribute("src"); v.el.load(); URL.revokeObjectURL(v.url); }
    this.videos.clear();
    this.comp.fechar();
  }
}

/** Texto com contorno (ou faixa de fundo, na legenda), quebrado para caber em 90% da largura. */
export function desenharTexto(ctx: CanvasRenderingContext2D, t: TextoEdicao, w: number, h: number) {
  if (!t.texto.trim()) return;
  const px = Math.max(10, t.tamanho * h);
  ctx.save();
  ctx.font = `${t.estilo === "titulo" ? 800 : 700} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const linhas = quebrarLinhas(t.texto, w * 0.9, s => ctx.measureText(s).width);
  const alt = px * 1.25, topo = t.y * h - ((linhas.length - 1) * alt) / 2;
  linhas.forEach((l, i) => {
    const y = topo + i * alt, x = t.x * w;
    if (t.fundo) {
      const lw = ctx.measureText(l).width + px * 0.6;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(x - lw / 2, y - alt / 2, lw, alt);
    } else {
      ctx.lineWidth = Math.max(2, px * 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineJoin = "round";
      ctx.strokeText(l, x, y);
    }
    ctx.fillStyle = t.cor;
    ctx.fillText(l, x, y);
  });
  ctx.restore();
}
