import type { PartidaEspelho, QuadroEspelho } from "@/react-app/utils/games/espelho";

/**
 * Transporte do espelho (o jogo inteiro em cada celular).
 *
 * - Caminho direto (preferido): conexão WebRTC entre a tela e cada celular, só pela rede local (sem servidores de fora,
 *   sem STUN/TURN). Os quadros vão por um canal de dados sem reenvio: se um quadro se perde, o próximo já chega.
 * - Caminho de reserva: pela sala (WebSocket do NordTool), com menos quadros por segundo, quando a conexão direta não
 *   abre (redes diferentes, Wi-Fi que isola aparelhos…).
 *
 * A negociação (oferta, resposta e candidatos) passa pela sala: a tela manda {@code para} a vaga e o celular responde
 * com {@code sinal}.
 */
type Enviar = (m: { t: string; [k: string]: unknown }) => void;

const CONFIG_RTC: RTCConfiguration = { iceServers: [] };
const temRtc = () => typeof RTCPeerConnection !== "undefined";

interface Par { pc: RTCPeerConnection; canal: RTCDataChannel | null }

/** Lado da tela: uma conexão por celular. */
export class TransmissorEspelho {
  private pares = new Map<number, Par>();

  constructor(private enviarSala: Enviar) {}

  /** O celular desta vaga está recebendo pelo caminho direto? */
  direto(vaga: number): boolean {
    return this.pares.get(vaga)?.canal?.readyState === "open";
  }

  /** Abre (ou reabre) a conexão direta com o celular da vaga. */
  async conectar(vaga: number) {
    if (!temRtc()) return;
    this.desconectar(vaga);
    const pc = new RTCPeerConnection(CONFIG_RTC);
    const canal = pc.createDataChannel("quadros", { ordered: false, maxRetransmits: 0 });
    const par: Par = { pc, canal };
    this.pares.set(vaga, par);
    pc.onicecandidate = ev => {
      if (ev.candidate) this.enviarSala({ t: "para", vaga, d: { k: "rtc", tipo: "ice", c: ev.candidate.toJSON() } });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") { canal.close(); par.canal = null; }
    };
    try {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      this.enviarSala({ t: "para", vaga, d: { k: "rtc", tipo: "oferta", sdp: oferta.sdp } });
    } catch {
      this.desconectar(vaga);
    }
  }

  /** Resposta e candidatos que o celular mandou (mensagem "sinal" da sala). */
  async receberSinal(vaga: number, d: unknown) {
    const par = this.pares.get(vaga);
    if (!par || !d || typeof d !== "object") return;
    const o = d as Record<string, unknown>;
    try {
      if (o.tipo === "resposta" && typeof o.sdp === "string") await par.pc.setRemoteDescription({ type: "answer", sdp: o.sdp });
      else if (o.tipo === "ice" && o.c && typeof o.c === "object") await par.pc.addIceCandidate(o.c as RTCIceCandidateInit);
    } catch {
      // Candidato que não serve: os outros seguem tentando.
    }
  }

  desconectar(vaga: number) {
    const par = this.pares.get(vaga);
    if (!par) return;
    try { par.canal?.close(); par.pc.close(); } catch { /* já fechada */ }
    this.pares.delete(vaga);
  }

  /** Início de partida: sempre pela sala (chega com certeza). */
  partida(vaga: number, p: PartidaEspelho) {
    this.enviarSala({ t: "para", vaga, d: { k: "partida", ...p } });
  }

  /**
   * Manda um quadro: direto se a conexão estiver aberta; senão pela sala, só 1 a cada {@code saltoSala} quadros e se
   * couber no limite da mensagem.
   */
  quadro(vaga: number, q: QuadroEspelho, saltoSala = 3) {
    const par = this.pares.get(vaga);
    const texto = JSON.stringify({ k: "quadro", ...q });
    if (par?.canal?.readyState === "open" && par.canal.bufferedAmount < 512 * 1024) {
      try { par.canal.send(texto); return; } catch { /* cai para a sala */ }
    }
    if (q.n % saltoSala !== 0 && q.m.fase === "jogando") return;
    if (texto.length > 46 * 1024) return;
    this.enviarSala({ t: "para", vaga, d: { k: "quadro", ...q } });
  }

  fechar() {
    for (const v of Array.from(this.pares.keys())) this.desconectar(v);
  }
}

/** Lado do celular: responde à oferta da tela e entrega os quadros que chegam (diretos ou pela sala). */
export class ReceptorEspelho {
  private pc: RTCPeerConnection | null = null;
  private pendentes: RTCIceCandidateInit[] = [];
  /** Caminho atual dos quadros: "direto" (Wi-Fi) ou "sala" (servidor). */
  caminho: "direto" | "sala" = "sala";

  constructor(private enviarSala: Enviar, private aoQuadro: (dados: unknown) => void, private aoCaminho?: (c: "direto" | "sala") => void) {}

  async receberSinal(d: Record<string, unknown>) {
    if (!temRtc()) return;
    try {
      if (d.tipo === "oferta" && typeof d.sdp === "string") {
        this.pc?.close();
        const pc = new RTCPeerConnection(CONFIG_RTC);
        this.pc = pc;
        pc.onicecandidate = ev => { if (ev.candidate) this.enviarSala({ t: "sinal", d: { tipo: "ice", c: ev.candidate.toJSON() } }); };
        pc.ondatachannel = ev => {
          const canal = ev.channel;
          canal.onopen = () => this.mudarCaminho("direto");
          canal.onclose = () => this.mudarCaminho("sala");
          canal.onmessage = m => {
            try { this.aoQuadro(JSON.parse(String(m.data))); } catch { /* quadro quebrado: o próximo vem */ }
          };
        };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") this.mudarCaminho("sala"); };
        await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
        for (const c of this.pendentes.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
        const resposta = await pc.createAnswer();
        await pc.setLocalDescription(resposta);
        this.enviarSala({ t: "sinal", d: { tipo: "resposta", sdp: resposta.sdp } });
      } else if (d.tipo === "ice" && d.c && typeof d.c === "object") {
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(d.c as RTCIceCandidateInit).catch(() => undefined);
        else this.pendentes.push(d.c as RTCIceCandidateInit);
      }
    } catch {
      this.mudarCaminho("sala");
    }
  }

  private mudarCaminho(c: "direto" | "sala") {
    if (this.caminho === c) return;
    this.caminho = c;
    this.aoCaminho?.(c);
  }

  fechar() {
    try { this.pc?.close(); } catch { /* já fechada */ }
    this.pc = null;
  }
}
