import { ICE_SERVERS, diferencaDeRelogio, lerSinal, type EstadoCamera, type Qualidade } from "@/react-app/utils/drumcamAoVivo";
import type { ReleDrumcam } from "./rele";

export type SituacaoConexao = "conectando" | "aovivo" | "caiu";

interface Pendente {
  ok: (r: Record<string, unknown>) => void;
  erro: (e: Error) => void;
  progresso?: (f: number) => void;
  arquivo?: { tamanho: number; mime: string; partes: ArrayBuffer[]; recebido: number; meta: Record<string, unknown> };
  timer: ReturnType<typeof setTimeout>;
}

/**
 * No painel: a conexão WebRTC com uma câmera ao vivo. Pede a imagem (com a qualidade da tela que está usando),
 * recebe o vídeo e o áudio, manda comandos pelo canal de dados e recebe arquivos (foto, gravação) com progresso.
 * Se a conexão cair, pede de novo sozinha.
 */
export class ConexaoCamera {
  stream: MediaStream | null = null;
  estado: EstadoCamera | null = null;
  situacao: SituacaoConexao = "conectando";
  /** Diferença do relógio da câmera para o deste aparelho (ms), para alinhar gravações. */
  diferenca = 0;
  zoomDigital = 1;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private candidatos: RTCIceCandidateInit[] = [];
  private pendentes = new Map<number, Pendente>();
  private seq = 0;
  private recebendo: number | null = null;
  private ouvintes = new Set<() => void>();
  private religar: ReturnType<typeof setTimeout> | undefined;
  private vivo = true;

  constructor(private readonly rele: ReleDrumcam, readonly id: string, public qualidade: Qualidade) {
    this.pedir();
  }

  /** Avisa as telas que algo mudou (imagem, estado, situação). */
  aoMudar(f: () => void) { this.ouvintes.add(f); return () => { this.ouvintes.delete(f); }; }
  private mudou() { for (const f of this.ouvintes) f(); }

  private pedir() {
    if (!this.vivo) return;
    this.fecharPc();
    this.situacao = "conectando";
    this.mudou();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.ontrack = ev => {
      this.stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.mudou();
    };
    pc.ondatachannel = ev => this.usarCanal(ev.channel);
    pc.onicecandidate = ev => { if (ev.candidate) this.rele.sinal(this.id, { tipo: "candidato", c: ev.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === "connected") { this.situacao = "aovivo"; this.mudou(); void this.acertarRelogio(); }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") this.agendarReconexao(pc.connectionState === "failed" ? 1_000 : 5_000);
    };
    if (!this.rele.sinal(this.id, { tipo: "quero", qualidade: this.qualidade })) this.agendarReconexao(3_000);
    // Sem resposta da câmera em 15 s: tenta de novo.
    this.religar = setTimeout(() => { if (this.situacao === "conectando") this.agendarReconexao(0); }, 15_000);
  }

  private agendarReconexao(ms: number) {
    if (!this.vivo) return;
    this.situacao = "caiu";
    this.mudou();
    if (this.religar) clearTimeout(this.religar);
    this.religar = setTimeout(() => this.pedir(), ms);
  }

  /** Sinal que chegou da câmera pelo relé. */
  async sinal(dados: unknown) {
    const s = lerSinal(dados);
    const pc = this.pc;
    if (!s || !pc) return;
    if (s.tipo === "oferta") {
      await pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
      for (const c of this.candidatos.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
      const resp = await pc.createAnswer();
      await pc.setLocalDescription(resp);
      this.rele.sinal(this.id, { tipo: "resposta", sdp: pc.localDescription?.sdp ?? resp.sdp });
    } else if (s.tipo === "candidato") {
      if (pc.remoteDescription) await pc.addIceCandidate(s.c).catch(() => undefined);
      else this.candidatos.push(s.c);
    } else if (s.tipo === "fim") this.agendarReconexao(3_000);
  }

  private usarCanal(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    dc.onmessage = ev => {
      if (typeof ev.data !== "string") return this.parteDeArquivo(ev.data as ArrayBuffer);
      let m: Record<string, unknown>;
      try { m = JSON.parse(ev.data) as Record<string, unknown>; } catch { return; }
      if (m.tipo === "estado" && m.estado && typeof m.estado === "object") { this.estado = m.estado as EstadoCamera; this.mudou(); return; }
      if (m.tipo !== "resp" || typeof m.id !== "number") return;
      const p = this.pendentes.get(m.id);
      if (!p) return;
      const arq = m.arquivo as { tamanho?: number; mime?: string } | undefined;
      if (m.ok && arq && typeof arq.tamanho === "number" && typeof arq.mime === "string" && !("sessao" in arq)) {
        // Começa a chegar um arquivo: as próximas mensagens binárias são dele.
        p.arquivo = { tamanho: arq.tamanho, mime: arq.mime, partes: [], recebido: 0, meta: m };
        this.recebendo = m.id;
        if (arq.tamanho === 0) this.terminarArquivo(m.id, p);
        return;
      }
      this.pendentes.delete(m.id);
      clearTimeout(p.timer);
      if (m.ok === false) p.erro(new Error(typeof m.erro === "string" ? m.erro : "A câmera não conseguiu."));
      else p.ok(m);
    };
    dc.onclose = () => { for (const [id, p] of this.pendentes) { clearTimeout(p.timer); p.erro(new Error("A conexão com a câmera caiu.")); this.pendentes.delete(id); } };
  }

  private parteDeArquivo(dados: ArrayBuffer) {
    const id = this.recebendo;
    const p = id === null ? undefined : this.pendentes.get(id);
    if (!p?.arquivo || id === null) return;
    p.arquivo.partes.push(dados);
    p.arquivo.recebido += dados.byteLength;
    p.progresso?.(p.arquivo.recebido / p.arquivo.tamanho);
    // Chegando partes, o prazo recomeça (um arquivo grande pode levar minutos).
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { this.pendentes.delete(id); p.erro(new Error("A câmera parou de mandar o arquivo.")); }, 30_000);
    if (p.arquivo.recebido >= p.arquivo.tamanho) this.terminarArquivo(id, p);
  }

  private terminarArquivo(id: number, p: Pendente) {
    this.pendentes.delete(id);
    clearTimeout(p.timer);
    this.recebendo = null;
    const a = p.arquivo!;
    p.ok({ ...a.meta, blob: new Blob(a.partes, { type: a.mime }) });
  }

  /** Comando para a câmera; resolve com a resposta (ou com `blob`, quando é arquivo). */
  comando(cmd: Record<string, unknown>, opcoes: { progresso?: (f: number) => void; prazo?: number } = {}): Promise<Record<string, unknown>> {
    const dc = this.dc;
    if (!dc || dc.readyState !== "open") return Promise.reject(new Error("A câmera não está conectada."));
    const id = ++this.seq;
    return new Promise((ok, erro) => {
      const timer = setTimeout(() => { this.pendentes.delete(id); erro(new Error("A câmera não respondeu.")); }, opcoes.prazo ?? 20_000);
      this.pendentes.set(id, { ok, erro, progresso: opcoes.progresso, timer });
      dc.send(JSON.stringify({ ...cmd, id }));
    });
  }

  /** Troca a qualidade da imagem (grade do monitoramento, estúdio, tela cheia). */
  async mudarQualidade(q: Qualidade) {
    if (q === this.qualidade) return;
    this.qualidade = q;
    await this.comando({ c: "qualidade", qualidade: q }).catch(() => undefined);
  }

  async zoom(valor: number) {
    const r = await this.comando({ c: "zoom", valor });
    this.zoomDigital = typeof r.zoomDigital === "number" ? r.zoomDigital : 1;
    this.mudou();
  }

  async foto(): Promise<Blob> {
    const r = await this.comando({ c: "foto" }, { prazo: 30_000 });
    return r.blob as Blob;
  }

  /** Mede a diferença de relógio (média de 3 idas e voltas, ficando com a mais rápida). */
  async acertarRelogio() {
    let melhor: { rtt: number; dif: number } | null = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const r = await this.comando({ c: "relogio" }).catch(() => null);
      const t1 = Date.now();
      if (!r || typeof r.hora !== "number") continue;
      const rtt = t1 - t0;
      if (!melhor || rtt < melhor.rtt) melhor = { rtt, dif: diferencaDeRelogio(t0, r.hora, t1) };
    }
    if (melhor) this.diferenca = melhor.dif;
  }

  private fecharPc() {
    if (this.religar) clearTimeout(this.religar);
    this.dc?.close();
    this.pc?.close();
    this.pc = null;
    this.dc = null;
    this.candidatos = [];
  }

  fechar() {
    this.vivo = false;
    this.rele.sinal(this.id, { tipo: "fim" });
    this.fecharPc();
    this.stream = null;
    this.ouvintes.clear();
  }
}
