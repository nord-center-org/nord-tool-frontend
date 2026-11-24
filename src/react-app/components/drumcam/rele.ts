import { API_BASE } from "@/react-app/config/api";
import { drumcamService } from "@/react-app/services/DrumcamService";
import { esperaDoRele, urlDoReleDrumcam } from "@/react-app/utils/drumcam";

export type EstadoRele = "conectando" | "conectado" | "caiu";
export interface CameraNaLista { id: string; nome: string; tipo: "app" | "aovivo" }

interface Ouvintes {
  estado?: (e: EstadoRele) => void;
  /** Papel "controle": a lista de câmeras da conta. */
  cameras?: (lista: CameraNaLista[]) => void;
  /** Sinal do WebRTC: `de` é o painel (na câmera) ou a câmera (no painel). */
  sinal?: (de: string, dados: unknown) => void;
  /** Papel "camera": o id desta câmera no relé (muda a cada conexão). */
  conectado?: (id: string) => void;
}

/**
 * Conexão com o relé do Drumcam (o WebSocket do NordTool), que volta sozinha se cair. A câmera ao vivo e o painel
 * usam a mesma classe; o relé só repassa entre aparelhos da mesma conta.
 */
export class ReleDrumcam {
  private ws: WebSocket | null = null;
  private vivo = true;
  private tentativa = 0;
  private espera: ReturnType<typeof setTimeout> | undefined;
  private ping: ReturnType<typeof setInterval> | undefined;
  /**
   * Passe de retomada (só câmera): o relé manda um novo a cada conexão. Depois de um deploy (o servidor reinicia e
   * derruba todos), a câmera volta com ele mesmo se o login do aparelho já tiver vencido.
   */
  private retomar: string | null = null;
  estado: EstadoRele = "conectando";

  constructor(private readonly papel: "camera" | "controle", private nome: string, private readonly ouvintes: Ouvintes, private readonly tipo: "aovivo" | "app" = "aovivo") {
    void this.conectar();
  }

  private mudar(e: EstadoRele) {
    this.estado = e;
    this.ouvintes.estado?.(e);
  }

  private async conectar() {
    if (!this.vivo) return;
    this.mudar("conectando");
    try {
      // Câmera com passe: volta direto, sem pedir bilhete (que exige login válido).
      const passe = this.papel === "camera" ? this.retomar : null;
      const b = passe ? { bilhete: passe } : await drumcamService.bilhete(this.papel, this.nome);
      if (!this.vivo || !b) return;
      const s = new WebSocket(urlDoReleDrumcam(API_BASE, window.location.origin, b.bilhete));
      this.ws = s;
      s.onopen = () => {
        this.tentativa = 0;
        this.mudar("conectado");
        if (this.papel === "camera") s.send(JSON.stringify({ t: "info", nome: this.nome, tipo: this.tipo }));
        this.ping = setInterval(() => { if (s.readyState === WebSocket.OPEN) s.send('{"t":"ping"}'); }, 25_000);
      };
      s.onmessage = ev => this.receber(String(ev.data));
      s.onclose = ev => {
        if (this.ping) clearInterval(this.ping);
        this.ws = null;
        // O relé recusou o passe (vencido ou de outro ambiente): a próxima tentativa pede bilhete com o login.
        if (passe && /inv[aá]lido|vencido/i.test(ev.reason ?? "")) this.retomar = null;
        if (!this.vivo) return;
        this.mudar("caiu");
        this.espera = setTimeout(() => void this.conectar(), esperaDoRele(this.tentativa++));
      };
    } catch {
      if (!this.vivo) return;
      this.mudar("caiu");
      this.espera = setTimeout(() => void this.conectar(), esperaDoRele(this.tentativa++));
    }
  }

  private receber(texto: string) {
    let m: Record<string, unknown>;
    try { m = JSON.parse(texto) as Record<string, unknown>; } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.t === "ok" && typeof m.id === "string") {
      if (typeof m.retomar === "string" && m.retomar.startsWith("r1.") && m.retomar.length < 500) this.retomar = m.retomar;
      this.ouvintes.conectado?.(m.id);
    }
    else if (m.t === "cameras" && Array.isArray(m.lista)) {
      this.ouvintes.cameras?.(m.lista
        .filter((c): c is { id: string; nome: string; tipo?: string } => !!c && typeof c.id === "string" && typeof c.nome === "string")
        .map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo === "aovivo" ? "aovivo" : "app" })));
    } else if (m.t === "sinal") {
      const de = typeof m.de === "string" ? m.de : typeof m.camera === "string" ? m.camera : "";
      if (de) this.ouvintes.sinal?.(de, m.dados);
    }
  }

  /** Sinal para um aparelho: no painel, `para` é a câmera; na câmera, é o painel ("*" = todos os painéis). */
  sinal(para: string, dados: unknown): boolean {
    const s = this.ws;
    if (!s || s.readyState !== WebSocket.OPEN) return false;
    s.send(JSON.stringify(this.papel === "controle" ? { t: "sinal", camera: para, dados } : { t: "sinal", para, dados }));
    return true;
  }

  /** A câmera troca o nome (aparece na lista de todos os painéis). */
  renomear(nome: string) {
    this.nome = nome;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "info", nome, tipo: this.tipo }));
  }

  fechar() {
    this.vivo = false;
    if (this.espera) clearTimeout(this.espera);
    if (this.ping) clearInterval(this.ping);
    this.ws?.close();
    this.ws = null;
  }
}
