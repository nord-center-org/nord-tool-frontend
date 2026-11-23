import {
  ICE_SERVERS, QUALIDADES, formatoDeGravacao, lenteParaZoom, lentesDosDispositivos, lerComando, lerSinal, ponteAoVivo,
  type Comando, type EstadoCamera, type Lente, type Qualidade,
} from "@/react-app/utils/drumcamAoVivo";
import { partes } from "./armazenamento";
import { ReleDrumcam, type EstadoRele } from "./rele";

interface Espectador { pc: RTCPeerConnection; dc: RTCDataChannel | null; qualidade: Qualidade; candidatos: RTCIceCandidateInit[] }

interface Eventos {
  estado?: (e: EstadoCamera) => void;
  rele?: (e: EstadoRele) => void;
  espectadores?: (n: number) => void;
  stream?: (s: MediaStream | null) => void;
  erro?: (mensagem: string) => void;
}

type ZoomCap = { min: number; max: number; step: number };

/**
 * Este aparelho como câmera ao vivo: abre a câmera e o microfone, transmite por WebRTC para cada painel que pedir
 * (cada um com a qualidade dele) e atende os comandos do painel pelo canal de dados (zoom, lente, lanterna, foto,
 * nome, gravar em alta qualidade e mandar o arquivo).
 */
export class CameraLocal {
  private rele: ReleDrumcam;
  private stream: MediaStream | null = null;
  private espectadores = new Map<string, Espectador>();
  private lentes: Lente[] = [];
  private lente = "";
  private altura = 1080;
  private zoomDigitalPedido = 1;
  private microfone = true;
  private lanterna: boolean | null = null;
  private bateria: { level: number; charging: boolean } | null = null;
  private gravador: MediaRecorder | null = null;
  private gravacao: { sessao: string; inicio: number; mime: string; n: number; tamanho: number } | null = null;
  private ultimoArquivo: { sessao: string; tamanho: number; mime: string; inicio: number } | null = null;
  private envio: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | undefined;
  private wakeLock: { release(): Promise<void> } | null = null;

  constructor(public nome: string, private readonly eventos: Eventos) {
    this.rele = new ReleDrumcam("camera", nome, {
      estado: e => eventos.rele?.(e),
      sinal: (de, dados) => void this.aoSinal(de, dados),
    });
    this.timer = setInterval(() => this.difundirEstado(), 2_000);
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener(t: string, f: () => void): void }> };
    nav.getBattery?.().then(b => {
      this.bateria = b;
      b.addEventListener("levelchange", () => this.difundirEstado());
    }).catch(() => undefined);
    void this.manterTela(true);
    void partes.limparMenos(null).catch(() => undefined);
  }

  // ------------------------------------------------------------ câmera

  async abrir(lente?: string, altura?: number) {
    if (lente !== undefined) this.lente = lente;
    if (altura) this.altura = altura;
    const antiga = this.stream;
    antiga?.getTracks().forEach(t => t.stop());
    const largura = Math.round(this.altura * 16 / 9);
    const video: MediaTrackConstraints = { height: { ideal: this.altura }, width: { ideal: largura }, frameRate: { ideal: 30 } };
    if (this.lente) video.deviceId = { exact: this.lente };
    else video.facingMode = { ideal: "environment" };
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        video,
        // Sem processamento: para música (bateria) o tratamento de voz estraga o som.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      // Sem microfone (ou negado): só a imagem.
      s = await navigator.mediaDevices.getUserMedia({ video });
    }
    this.stream = s;
    s.getAudioTracks().forEach(t => { t.enabled = this.microfone; });
    const v = s.getVideoTracks()[0];
    this.lente = v?.getSettings().deviceId ?? this.lente;
    // Com a permissão dada, os nomes das lentes aparecem.
    const dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    this.lentes = lentesDosDispositivos(dispositivos.map(d => ({ deviceId: d.deviceId, label: d.label })));
    this.lanterna = this.capacidades()?.torch ? false : null;
    // Os painéis já conectados passam a receber a câmera nova.
    for (const e of this.espectadores.values()) {
      for (const sender of e.pc.getSenders()) {
        const novo = s.getTracks().find(t => t.kind === sender.track?.kind);
        if (novo) void sender.replaceTrack(novo);
      }
    }
    this.eventos.stream?.(s);
    this.difundirEstado();
  }

  private trilhaDeVideo() { return this.stream?.getVideoTracks()[0] ?? null; }
  private capacidades(): (MediaTrackCapabilities & { zoom?: ZoomCap; torch?: boolean }) | null {
    const t = this.trilhaDeVideo();
    return t && typeof t.getCapabilities === "function" ? t.getCapabilities() as MediaTrackCapabilities & { zoom?: ZoomCap; torch?: boolean } : null;
  }

  estado(): EstadoCamera {
    const t = this.trilhaDeVideo();
    const conf = (t?.getSettings() ?? {}) as MediaTrackSettings & { zoom?: number };
    const cap = this.capacidades()?.zoom;
    return {
      nome: this.nome,
      bateria: this.bateria ? Math.round(this.bateria.level * 100) : null,
      carregando: this.bateria ? this.bateria.charging : null,
      largura: conf.width ?? 0,
      altura: conf.height ?? 0,
      zoom: cap ? { min: cap.min, max: cap.max, passo: cap.step || 0.1, valor: conf.zoom ?? cap.min } : null,
      lentes: this.lentes,
      lente: this.lente,
      lanterna: this.lanterna,
      microfone: this.microfone,
      gravando: this.gravacao?.sessao ?? null,
      gravandoDesde: this.gravacao?.inicio ?? null,
      arquivo: this.ultimoArquivo,
    };
  }

  private difundirEstado() {
    const e = this.estado();
    this.eventos.estado?.(e);
    const msg = JSON.stringify({ tipo: "estado", estado: e });
    for (const esp of this.espectadores.values()) if (esp.dc?.readyState === "open") esp.dc.send(msg);
  }

  async zoom(valor: number) {
    // 0,5× e o tele trocam de lente; dentro da lente, o zoom óptico/digital do próprio aparelho.
    const alvo = lenteParaZoom(valor, this.lentes, this.lente);
    if (alvo.lente && alvo.lente !== this.lente) await this.abrir(alvo.lente);
    const cap = this.capacidades()?.zoom;
    const t = this.trilhaDeVideo();
    if (cap && t) {
      const z = Math.min(cap.max, Math.max(cap.min, alvo.zoom));
      await t.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).catch(() => undefined);
    }
    this.zoomDigitalPedido = cap ? 1 : alvo.zoom;
    this.difundirEstado();
  }

  /** Zoom que a câmera não faz sozinha (aparelho sem zoom): o painel aplica cortando a imagem. */
  get zoomDigital() { return this.zoomDigitalPedido; }

  async alternarLanterna(ligada: boolean) {
    const t = this.trilhaDeVideo();
    if (!t || this.lanterna === null) return;
    await t.applyConstraints({ advanced: [{ torch: ligada } as MediaTrackConstraintSet] }).catch(() => undefined);
    this.lanterna = ligada;
    this.difundirEstado();
  }

  ligarMicrofone(ligado: boolean) {
    this.microfone = ligado;
    this.stream?.getAudioTracks().forEach(t => { t.enabled = ligado; });
    this.difundirEstado();
  }

  renomear(nome: string) {
    const n = nome.trim().slice(0, 60) || "Câmera";
    this.nome = n;
    try { localStorage.setItem("drumcam-nome", n); } catch { /* sem armazenamento */ }
    this.rele.renomear(n);
    this.difundirEstado();
  }

  /** Foto na resolução cheia da câmera (ImageCapture quando o navegador tem; senão, o quadro do vídeo). */
  async foto(): Promise<Blob> {
    const t = this.trilhaDeVideo();
    if (!t) throw new Error("Câmera fechada.");
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
    if (IC) {
      try { return await new IC(t).takePhoto(); } catch { /* cai para o quadro do vídeo */ }
    }
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([t]);
    await v.play();
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    v.pause(); v.srcObject = null;
    return await new Promise<Blob>((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error("Sem imagem."))), "image/jpeg", 0.92));
  }

  // ------------------------------------------------------------ gravação em alta qualidade

  async gravar(sessao: string) {
    if (!this.stream) throw new Error("Câmera fechada.");
    if (this.gravador) await this.parar();
    const { mime } = formatoDeGravacao(m => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(this.stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 });
    const g = { sessao, inicio: Date.now(), mime: rec.mimeType || mime || "video/webm", n: 0, tamanho: 0 };
    this.gravacao = g;
    await partes.apagar(sessao).catch(() => undefined);
    rec.ondataavailable = ev => {
      if (!ev.data.size) return;
      const n = g.n++;
      g.tamanho += ev.data.size;
      void partes.guardar(sessao, n, ev.data);
    };
    rec.start(1000);
    g.inicio = Date.now();
    this.gravador = rec;
    this.difundirEstado();
  }

  async parar(): Promise<EstadoCamera["arquivo"]> {
    const rec = this.gravador, g = this.gravacao;
    if (!rec || !g) return this.ultimoArquivo;
    await new Promise<void>(ok => { rec.onstop = () => ok(); rec.stop(); });
    // Espera a última parte entrar no banco.
    await new Promise(r => setTimeout(r, 300));
    this.gravador = null;
    this.gravacao = null;
    this.ultimoArquivo = { sessao: g.sessao, tamanho: g.tamanho, mime: g.mime, inicio: g.inicio };
    this.difundirEstado();
    return this.ultimoArquivo;
  }

  // ------------------------------------------------------------ WebRTC

  private async aoSinal(de: string, dados: unknown) {
    const s = lerSinal(dados);
    if (!s) return;
    if (s.tipo === "quero") return this.novoEspectador(de, s.qualidade);
    const e = this.espectadores.get(de);
    if (!e) return;
    if (s.tipo === "resposta") {
      await e.pc.setRemoteDescription({ type: "answer", sdp: s.sdp }).catch(() => undefined);
      for (const c of e.candidatos.splice(0)) await e.pc.addIceCandidate(c).catch(() => undefined);
    } else if (s.tipo === "candidato") {
      if (e.pc.remoteDescription) await e.pc.addIceCandidate(s.c).catch(() => undefined);
      else e.candidatos.push(s.c);
    } else if (s.tipo === "fim") this.fecharEspectador(de);
  }

  private async novoEspectador(de: string, qualidade: Qualidade) {
    this.fecharEspectador(de);
    if (!this.stream) await this.abrir().catch(err => this.eventos.erro?.(String(err?.message ?? err)));
    if (!this.stream) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const e: Espectador = { pc, dc: null, qualidade, candidatos: [] };
    this.espectadores.set(de, e);
    for (const t of this.stream.getTracks()) pc.addTrack(t, this.stream);
    const dc = pc.createDataChannel("drumcam", { ordered: true });
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 1 << 20;
    e.dc = dc;
    dc.onopen = () => { dc.send(JSON.stringify({ tipo: "estado", estado: this.estado() })); };
    dc.onmessage = ev => { if (typeof ev.data === "string") void this.aoComando(e, ev.data); };
    pc.onicecandidate = ev => { if (ev.candidate) this.rele.sinal(de, { tipo: "candidato", c: ev.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.fecharEspectador(de);
      this.eventos.espectadores?.(this.espectadores.size);
    };
    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    await this.aplicarQualidade(e);
    this.rele.sinal(de, { tipo: "oferta", sdp: pc.localDescription?.sdp ?? oferta.sdp });
    this.eventos.espectadores?.(this.espectadores.size);
  }

  private async aplicarQualidade(e: Espectador) {
    const q = QUALIDADES[e.qualidade];
    for (const sender of e.pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = q.maxBitrate;
      p.encodings[0].scaleResolutionDownBy = q.escala;
      p.encodings[0].maxFramerate = q.fps;
      await sender.setParameters(p).catch(() => undefined);
    }
  }

  private fecharEspectador(de: string) {
    const e = this.espectadores.get(de);
    if (!e) return;
    this.espectadores.delete(de);
    e.dc?.close();
    e.pc.close();
    this.eventos.espectadores?.(this.espectadores.size);
  }

  private responder(e: Espectador, id: number, dados: Record<string, unknown>) {
    if (e.dc?.readyState === "open") e.dc.send(JSON.stringify({ tipo: "resp", id, ...dados }));
  }

  /** Manda um arquivo pelo canal de dados: aviso com o tamanho, as partes em binário (respeitando o buffer) e o fim. */
  private enviarArquivo(e: Espectador, id: number, blob: Blob, extra: Record<string, unknown> = {}) {
    const dc = e.dc;
    // Um envio por vez (os pedaços binários de dois arquivos não podem se misturar).
    this.envio = this.envio.then(async () => {
      if (!dc || dc.readyState !== "open") return;
      dc.send(JSON.stringify({ tipo: "resp", id, ok: true, arquivo: { tamanho: blob.size, mime: blob.type }, ...extra }));
      const PARTE = 64 * 1024;
      for (let i = 0; i < blob.size; i += PARTE) {
        if (dc.readyState !== "open") return;
        if (dc.bufferedAmount > 8 * PARTE * 16) await new Promise<void>(ok => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; ok(); }; });
        dc.send(await blob.slice(i, i + PARTE).arrayBuffer());
      }
    });
    return this.envio;
  }

  private async aoComando(e: Espectador, texto: string) {
    let bruto: unknown;
    try { bruto = JSON.parse(texto); } catch { return; }
    const cmd = lerComando(bruto) as (Comando & { id: number }) | null;
    if (!cmd) return;
    try {
      switch (cmd.c) {
        case "estado": this.responder(e, cmd.id, { ok: true, estado: this.estado() }); break;
        case "relogio": this.responder(e, cmd.id, { ok: true, hora: Date.now() }); break;
        case "zoom": await this.zoom(cmd.valor); this.responder(e, cmd.id, { ok: true, zoomDigital: this.zoomDigital }); break;
        case "lente": await this.abrir(cmd.lente); this.responder(e, cmd.id, { ok: true }); break;
        case "resolucao": await this.abrir(undefined, cmd.altura); this.responder(e, cmd.id, { ok: true }); break;
        case "lanterna": await this.alternarLanterna(cmd.ligada); this.responder(e, cmd.id, { ok: true }); break;
        case "microfone": this.ligarMicrofone(cmd.ligado); this.responder(e, cmd.id, { ok: true }); break;
        case "nome": this.renomear(cmd.nome); this.responder(e, cmd.id, { ok: true }); break;
        case "qualidade": e.qualidade = cmd.qualidade; await this.aplicarQualidade(e); this.responder(e, cmd.id, { ok: true }); break;
        case "foto": await this.enviarArquivo(e, cmd.id, await this.foto()); break;
        case "gravar": await this.gravar(cmd.sessao); this.responder(e, cmd.id, { ok: true, inicio: this.gravacao?.inicio }); break;
        case "parar": this.responder(e, cmd.id, { ok: true, arquivo: await this.parar() }); break;
        case "arquivo": {
          const a = this.ultimoArquivo;
          if (!a || a.sessao !== cmd.sessao) { this.responder(e, cmd.id, { ok: false, erro: "Esta gravação não está nesta câmera." }); break; }
          const blob = await partes.juntar(a.sessao, a.mime);
          await this.enviarArquivo(e, cmd.id, blob, { inicio: a.inicio });
          break;
        }
      }
    } catch (err) {
      this.responder(e, cmd.id, { ok: false, erro: String((err as Error)?.message ?? err) });
    }
  }

  /** No app 9.0+, a câmera segue no ar com a tela apagada; no navegador (ou app antigo), a tela fica ligada. */
  readonly segundoPlano = ponteAoVivo() !== null;

  private async manterTela(ligada: boolean) {
    const aoVivo = ponteAoVivo();
    if (aoVivo && aoVivo(ligada, this.nome)) return;
    (window as unknown as { NordAndroid?: { manterTelaLigada?: (l: boolean) => void } }).NordAndroid?.manterTelaLigada?.(ligada);
    const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (ligada && wl) this.wakeLock = await wl.request("screen").catch(() => null);
    if (!ligada) { await this.wakeLock?.release().catch(() => undefined); this.wakeLock = null; }
  }

  fechar() {
    if (this.timer) clearInterval(this.timer);
    for (const id of [...this.espectadores.keys()]) { this.rele.sinal(id, { tipo: "fim" }); this.fecharEspectador(id); }
    this.gravador?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.eventos.stream?.(null);
    this.rele.fechar();
    void this.manterTela(false);
  }
}
