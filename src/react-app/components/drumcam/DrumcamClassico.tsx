import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, ExternalLink, Globe, Loader2, RefreshCw, Smartphone, Video, Wifi } from "lucide-react";
import { API_BASE } from "@/react-app/config/api";
import { drumcamService } from "@/react-app/services/DrumcamService";
import {
  enderecoDaCamera, esperaDoRele, lerMsgRele, mensagemParaCamera, pedidoDoPainel, ponteDrumcam, urlDoReleDrumcam, type CameraOnline,
} from "@/react-app/utils/drumcam";

type EstadoRele = "conectando" | "conectado" | "caiu";

/**
 * Estúdio → Câmeras → "Câmera do app" (Drumcam v1/v2): um celular parado vira câmera (grava a bateria com o áudio do iRig) e outro aparelho controla.
 * - No app NordTool: "Usar este celular como câmera" e "Controlar no Wi-Fi" (painel completo, com download).
 * - Pela internet, de qualquer lugar: a câmera fica no relé do NordTool e o painel abre aqui mesmo.
 * - No computador, no mesmo Wi-Fi: abre o endereço da câmera no navegador.
 */
export default function DrumcamClassico() {
  const ponte = ponteDrumcam();
  const [ativa, setAtiva] = useState(() => ponte?.drumcamAtiva() ?? false);
  const [estado, setEstado] = useState<EstadoRele>("conectando");
  const [cameras, setCameras] = useState<CameraOnline[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [endereco, setEndereco] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const painel = useRef<HTMLIFrameElement | null>(null);
  // Pedido do relé → id do pedido no painel (cada pedido do painel ganha um id novo no relé).
  const pendentes = useRef(new Map<number, number>());
  const seq = useRef(0);
  const escolhidaRef = useRef<string | null>(null);
  escolhidaRef.current = escolhida;

  const responderPainel = useCallback((dados: Record<string, unknown>) => {
    painel.current?.contentWindow?.postMessage({ ...dados, tipo: "drumcam-resp" }, window.location.origin);
  }, []);

  // Conexão com o relé (papel "controle"), que volta sozinha se cair.
  useEffect(() => {
    let vivo = true, tentativa = 0, espera: ReturnType<typeof setTimeout> | undefined, ping: ReturnType<typeof setInterval> | undefined;
    const conectar = async () => {
      if (!vivo) return;
      setEstado("conectando");
      try {
        const b = await drumcamService.bilhete("controle");
        if (!vivo || !b) return;
        const s = new WebSocket(urlDoReleDrumcam(API_BASE, window.location.origin, b.bilhete));
        ws.current = s;
        s.onopen = () => { tentativa = 0; setEstado("conectado"); ping = setInterval(() => { if (s.readyState === WebSocket.OPEN) s.send('{"t":"ping"}'); }, 30_000); };
        s.onmessage = (ev) => {
          const m = lerMsgRele(String(ev.data));
          if (m.t === "cameras") {
            setCameras(m.lista);
            if (escolhidaRef.current && !m.lista.some(c => c.id === escolhidaRef.current)) setEscolhida(null);
            if (!escolhidaRef.current && m.lista.length === 1) setEscolhida(m.lista[0].id);
          } else if (m.t === "resp") {
            const idPainel = pendentes.current.get(m.id);
            if (idPainel === undefined) return;
            pendentes.current.delete(m.id);
            responderPainel({ id: idPainel, s: m.s, tipoConteudo: m.tipo, b: m.b, erro: m.erro });
          }
        };
        s.onclose = () => {
          if (ping) clearInterval(ping);
          ws.current = null;
          // Pedidos em andamento falham na hora (o painel mostra "sem conexão" e tenta de novo).
          for (const idPainel of pendentes.current.values()) responderPainel({ id: idPainel, s: 0, erro: "A conexão com o NordTool caiu." });
          pendentes.current.clear();
          if (!vivo) return;
          setEstado("caiu");
          espera = setTimeout(conectar, esperaDoRele(tentativa++));
        };
      } catch {
        if (!vivo) return;
        setEstado("caiu");
        espera = setTimeout(conectar, esperaDoRele(tentativa++));
      }
    };
    void conectar();
    return () => { vivo = false; if (espera) clearTimeout(espera); if (ping) clearInterval(ping); ws.current?.close(); };
  }, [responderPainel]);

  // Pedidos do painel (iframe da mesma origem) → relé → câmera escolhida.
  useEffect(() => {
    const ouvir = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== painel.current?.contentWindow) return;
      if ((ev.data as { tipo?: string } | null)?.tipo === "drumcam-trocar") { setEscolhida(null); return; }
      const p = pedidoDoPainel(ev.data);
      if (!p) return;
      const s = ws.current, cam = escolhidaRef.current;
      if (!s || s.readyState !== WebSocket.OPEN || !cam) { responderPainel({ id: p.id, s: 0 }); return; }
      const id = ++seq.current;
      pendentes.current.set(id, p.id);
      s.send(JSON.stringify(mensagemParaCamera(cam, id, p)));
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [responderPainel]);

  // O estado "este celular é câmera" muda fora da página (a tela nativa); confere ao voltar.
  useEffect(() => {
    if (!ponte) return;
    const ver = () => { if (!document.hidden) setAtiva(ponte.drumcamAtiva()); };
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, [ponte]);

  const enderecoPainel = enderecoDaCamera(endereco);
  const camera = cameras.find(c => c.id === escolhida);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-xs text-slate-400"><Video className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        Câmera do app (grava no próprio celular em 1080p, com o áudio do iRig, e publica no YouTube com o título no padrão). Para o estúdio com várias câmeras e o monitoramento, use a câmera ao vivo acima.</p>

      {ponte ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => ponte.drumcamCamera()}
            className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left hover:bg-red-500/20">
            <Camera className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <span><span className="block font-bold text-slate-100">{ativa ? "Este celular é a câmera" : "Usar este celular como câmera"}</span>
              <span className="block text-xs text-slate-400">{ativa ? "Toque para ver o endereço, o PIN e as opções." : "Ele fica pronto de tela apagada e volta sozinho se religar. Deixe na tomada."}</span></span>
          </button>
          <button type="button" onClick={() => ponte.drumcamControlar()}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#181b22] p-4 text-left hover:bg-white/5">
            <Wifi className="mt-0.5 h-6 w-6 shrink-0 text-sky-600" />
            <span><span className="block font-bold text-slate-100">Controlar no Wi-Fi</span>
              <span className="block text-xs text-slate-400">Acha a câmera na rede e abre o painel completo, com download dos vídeos para este celular.</span></span>
          </button>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Para usar um celular como câmera, abra o NordTool pelo <b>app Android</b> (versão 6.0 ou mais nova) nele e entre aqui em Repertório → Drumcam.
            <a href="/app/nordtool.apk" className="ml-1 inline-flex items-center gap-1 font-bold underline"><Download className="h-3 w-3" />Baixar o app</a></span>
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#181b22] p-4" aria-label="Câmeras pela internet">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="mr-auto flex items-center gap-2 font-bold text-slate-100"><Globe className="h-4 w-4 text-emerald-600" />Pela internet</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${estado === "conectado" ? "bg-emerald-500/15 text-emerald-300" : estado === "conectando" ? "bg-white/10 text-slate-300" : "bg-red-500/15 text-red-300"}`}>
            {estado === "conectado" ? "conectado ao NordTool" : estado === "conectando" ? "conectando…" : "sem conexão, tentando de novo"}
          </span>
        </div>
        {cameras.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            {estado === "conectando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Nenhuma câmera ligada na sua conta. No celular-câmera, abra o app NordTool (com a sua conta), entre em Repertório → Drumcam e toque em “Usar este celular como câmera”.
          </p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Câmera">
            {cameras.map(c => (
              <button key={c.id} type="button" role="radio" aria-checked={escolhida === c.id} onClick={() => setEscolhida(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold ${escolhida === c.id ? "border-red-500 bg-red-500/15 text-red-300" : "border-white/10 text-slate-200 hover:bg-white/5"}`}>
                <Camera className="h-4 w-4" />{c.nome}
              </button>
            ))}
          </div>
        )}
        {camera && (
          <iframe key={camera.id} ref={painel} title={`Painel da ${camera.nome}`} src="/drumcam/painel.html?rele=1"
            className="h-[78vh] min-h-[520px] w-full rounded-xl border border-white/10 bg-slate-950" />
        )}
        {camera && <p className="mt-2 text-[11px] text-slate-400">Pela internet passam os comandos, a prévia e as thumbs; o vídeo vai direto da câmera para o YouTube. Para baixar o vídeo, use o mesmo Wi-Fi da câmera.</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#181b22] p-4" aria-label="No mesmo Wi-Fi pelo navegador">
        <p className="mb-2 flex items-center gap-2 font-bold text-slate-100"><Wifi className="h-4 w-4 text-sky-600" />No computador, no mesmo Wi-Fi</p>
        <p className="mb-2 text-xs text-slate-400">Digite o endereço que aparece na tela do celular-câmera (e use o PIN de lá). Abre o painel completo, com download dos vídeos.</p>
        <div className="flex gap-2">
          <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="ex.: 192.168.0.15:8080" aria-label="Endereço da câmera"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
          <a href={enderecoPainel ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!enderecoPainel}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-white ${enderecoPainel ? "bg-slate-800 hover:bg-slate-700" : "pointer-events-none bg-slate-300"}`}>
            <ExternalLink className="h-4 w-4" />Abrir
          </a>
        </div>
      </section>
    </div>
  );
}
