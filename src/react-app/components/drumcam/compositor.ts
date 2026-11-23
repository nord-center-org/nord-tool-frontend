import {
  CANAL_PADRAO, DIMENSOES, FILTRO_NEUTRO, cssDoFiltro, formatoDeGravacao, ganhoEfetivo, nivelDoMedidor, retanguloDeDesenho,
  type Camada, type Canal, type Filtro, type Formato,
} from "@/react-app/utils/drumcamAoVivo";

export interface Fonte {
  id: string;
  video: HTMLVideoElement;
  camada: Camada;
  filtro: Filtro;
  canal: Canal;
  /** Zoom que a câmera não faz sozinha (corte no centro). */
  zoomDigital: number;
  audio?: { origem: AudioNode; ganho: GainNode; pan: StereoPannerNode; medidor: AnalyserNode; chave: MediaStream | HTMLMediaElement };
}

/**
 * Mesa de corte do estúdio: desenha as câmeras num canvas (posição, recorte, filtros, espelho, cantos arredondados,
 * vinheta), mistura o áudio de cada uma (ganho, mudo, solo, pan) e grava o resultado. Serve tanto para o ao vivo
 * (vídeos com o stream do WebRTC) quanto para a montagem em alta qualidade (vídeos com os arquivos das câmeras).
 */
export class Compositor {
  readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  readonly audio: AudioContext;
  private mestre: GainNode;
  private medidorMestre: AnalyserNode;
  private destino: MediaStreamAudioDestinationNode;
  private escuta: GainNode;
  fontes = new Map<string, Fonte>();
  fundo = "#000000";
  private quadro = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private gravador: MediaRecorder | null = null;
  private partes: Blob[] = [];
  gravandoDesde: number | null = null;

  constructor(public formato: Formato = "16:9") {
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.redimensionar(formato);
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audio = new AC();
    this.mestre = this.audio.createGain();
    this.medidorMestre = this.audio.createAnalyser();
    this.medidorMestre.fftSize = 1024;
    this.destino = this.audio.createMediaStreamDestination();
    this.escuta = this.audio.createGain();
    this.escuta.gain.value = 0;
    this.mestre.connect(this.medidorMestre);
    this.mestre.connect(this.destino);
    this.mestre.connect(this.escuta).connect(this.audio.destination);
    this.desenhar = this.desenhar.bind(this);
    this.agendar();
  }

  redimensionar(formato: Formato) {
    this.formato = formato;
    const d = DIMENSOES[formato];
    this.canvas.width = d.w;
    this.canvas.height = d.h;
  }

  /** Câmera nova (ou troca do vídeo da mesma câmera). */
  fonte(id: string, video: HTMLVideoElement, camada: Camada, audio: MediaStream | HTMLMediaElement | null): Fonte {
    let f = this.fontes.get(id);
    if (!f) {
      f = { id, video, camada, filtro: { ...FILTRO_NEUTRO }, canal: { ...CANAL_PADRAO }, zoomDigital: 1 };
      this.fontes.set(id, f);
    }
    f.video = video;
    f.camada = camada;
    if (audio && f.audio?.chave !== audio) this.ligarAudio(f, audio);
    return f;
  }

  private ligarAudio(f: Fonte, audio: MediaStream | HTMLMediaElement) {
    f.audio?.origem.disconnect();
    f.audio?.ganho.disconnect();
    let origem: AudioNode;
    if (audio instanceof MediaStream) {
      if (!audio.getAudioTracks().length) { f.audio = undefined; return; }
      origem = this.audio.createMediaStreamSource(audio);
    } else origem = this.audio.createMediaElementSource(audio);
    const ganho = this.audio.createGain(), pan = this.audio.createStereoPanner(), medidor = this.audio.createAnalyser();
    medidor.fftSize = 1024;
    origem.connect(ganho).connect(pan).connect(this.mestre);
    origem.connect(medidor);
    f.audio = { origem, ganho, pan, medidor, chave: audio };
    this.aplicarMixer();
  }

  remover(id: string) {
    const f = this.fontes.get(id);
    f?.audio?.origem.disconnect();
    f?.audio?.ganho.disconnect();
    this.fontes.delete(id);
  }

  /** Ganhos de todos os canais (o solo de um muda os outros). */
  aplicarMixer(mestre?: number) {
    const algumSolo = [...this.fontes.values()].some(f => f.canal.solo);
    for (const f of this.fontes.values()) {
      if (!f.audio) continue;
      f.audio.ganho.gain.setTargetAtTime(ganhoEfetivo(f.canal, algumSolo), this.audio.currentTime, 0.02);
      f.audio.pan.pan.setTargetAtTime(f.canal.pan, this.audio.currentTime, 0.02);
    }
    if (mestre !== undefined) this.mestre.gain.setTargetAtTime(mestre, this.audio.currentTime, 0.02);
  }

  /** Ouvir a mistura neste aparelho (fone). Desligado por padrão, para não microfonar. */
  ouvir(ligado: boolean) { this.escuta.gain.setTargetAtTime(ligado ? 1 : 0, this.audio.currentTime, 0.02); }

  /** Níveis dos medidores (0 a 1) de cada câmera e do mestre. */
  niveis(): { mestre: number; canais: Record<string, number> } {
    const ler = (a: AnalyserNode) => { const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); return nivelDoMedidor(b); };
    const canais: Record<string, number> = {};
    for (const f of this.fontes.values()) canais[f.id] = f.audio ? ler(f.audio.medidor) * (f.canal.mudo ? 0.25 : 1) : 0;
    return { mestre: ler(this.medidorMestre), canais };
  }

  // O desenho continua com a aba em segundo plano (o requestAnimationFrame para; o timer não).
  private agendar() {
    if (document.hidden || this.gravador) this.timer = setTimeout(this.desenhar, 1000 / 30);
    else this.quadro = requestAnimationFrame(this.desenhar);
  }

  private desenhar() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.filter = "none";
    ctx.fillStyle = this.fundo;
    ctx.fillRect(0, 0, W, H);
    const ordem = [...this.fontes.values()].filter(f => f.camada.visivel).sort((a, b) => a.camada.z - b.camada.z);
    for (const f of ordem) {
      const v = f.video;
      if (v.readyState < 2 || !v.videoWidth) continue;
      // Zoom digital: corta o centro da imagem.
      const z = Math.max(1, f.zoomDigital);
      const vw = v.videoWidth / z, vh = v.videoHeight / z, ox = (v.videoWidth - vw) / 2, oy = (v.videoHeight - vh) / 2;
      const r = retanguloDeDesenho(vw, vh, f.camada, W, H);
      ctx.save();
      const raio = f.camada.raio * Math.min(r.dw, r.dh);
      ctx.beginPath();
      if (raio > 0 && "roundRect" in ctx) ctx.roundRect(f.camada.x * W, f.camada.y * H, f.camada.w * W, f.camada.h * H, raio);
      else ctx.rect(f.camada.x * W, f.camada.y * H, f.camada.w * W, f.camada.h * H);
      ctx.clip();
      ctx.filter = cssDoFiltro(f.filtro);
      if (f.camada.espelhar) {
        ctx.translate(r.dx + r.dw, r.dy);
        ctx.scale(-1, 1);
        ctx.drawImage(v, ox + r.sx, oy + r.sy, r.sw, r.sh, 0, 0, r.dw, r.dh);
      } else ctx.drawImage(v, ox + r.sx, oy + r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
      ctx.filter = "none";
      if (f.filtro.vinheta > 0) {
        const cx = r.dx + r.dw / 2, cy = r.dy + r.dh / 2;
        const g = ctx.createRadialGradient(cx, cy, Math.min(r.dw, r.dh) * 0.3, cx, cy, Math.hypot(r.dw, r.dh) / 2);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(0,0,0,${f.filtro.vinheta / 100})`);
        ctx.fillStyle = g;
        ctx.fillRect(r.dx, r.dy, r.dw, r.dh);
      }
      ctx.restore();
    }
    this.agendar();
  }

  /** Começa a gravar o programa (imagem + mistura). */
  gravar(): string {
    const { mime } = formatoDeGravacao(m => MediaRecorder.isTypeSupported(m));
    const stream = this.canvas.captureStream(30);
    for (const t of this.destino.stream.getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 });
    this.partes = [];
    rec.ondataavailable = ev => { if (ev.data.size) this.partes.push(ev.data); };
    rec.start(1000);
    this.gravador = rec;
    this.gravandoDesde = Date.now();
    void this.audio.resume();
    return rec.mimeType || mime;
  }

  async parar(): Promise<{ blob: Blob; duracao: number }> {
    const rec = this.gravador;
    if (!rec) throw new Error("Não está gravando.");
    await new Promise<void>(ok => { rec.onstop = () => ok(); rec.stop(); });
    const duracao = (Date.now() - (this.gravandoDesde ?? Date.now())) / 1000;
    this.gravador = null;
    this.gravandoDesde = null;
    return { blob: new Blob(this.partes, { type: rec.mimeType || "video/webm" }), duracao };
  }

  get gravando() { return !!this.gravador; }

  /** Miniatura do programa agora (para a galeria). */
  miniatura(largura = 320): string {
    const c = document.createElement("canvas");
    c.width = largura;
    c.height = Math.round(largura * this.canvas.height / this.canvas.width);
    c.getContext("2d")!.drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  }

  fechar() {
    cancelAnimationFrame(this.quadro);
    if (this.timer) clearTimeout(this.timer);
    if (this.gravador?.state === "recording") this.gravador.stop();
    for (const id of [...this.fontes.keys()]) this.remover(id);
    void this.audio.close();
  }
}
