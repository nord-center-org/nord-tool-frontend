import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Camera, Clapperboard, FolderOpen, Loader2, MonitorPlay, Power, Radio, Smartphone, Video } from "lucide-react";
import { ponteCameraServico, type EstadoCameraServico } from "@/react-app/utils/drumcamAoVivo";
import { lerSessao } from "@/react-app/utils/sessao";
import { ProvedorAoVivo, useAoVivo } from "./AoVivo";
import CameraAoVivoTela from "./CameraAoVivoTela";
import DrumcamClassico from "./DrumcamClassico";

const EstudioDrumcam = lazy(() => import("./EstudioDrumcam"));
const MonitorDrumcam = lazy(() => import("./MonitorDrumcam"));
const GaleriaDrumcam = lazy(() => import("./GaleriaDrumcam"));

type Aba = "estudio" | "monitor" | "galeria" | "cameras";
const ABAS: { id: Aba; nome: string; icone: typeof Video }[] = [
  { id: "estudio", nome: "Mesa", icone: Clapperboard },
  { id: "monitor", nome: "Monitoramento", icone: MonitorPlay },
  { id: "galeria", nome: "Galeria", icone: FolderOpen },
  { id: "cameras", nome: "Câmeras", icone: Camera },
];

/**
 * Estúdio → Gravação (Drumcam v3; v4: a tela toda virou Estúdio e esta parte, Gravação): mesa de transmissão no estilo dos programas de live. Várias câmeras ao vivo
 * (WebRTC) num vídeo só, com cenas, posições, filtros e mixer; monitoramento das câmeras em grade; galeria para
 * assistir sem baixar; e as câmeras (este aparelho como câmera ao vivo, e a câmera do app com YouTube).
 */
export default function DrumcamRepertorio() {
  return (
    <ProvedorAoVivo>
      <Mesa />
    </ProvedorAoVivo>
  );
}

/** Nome desta câmera: o último usado neste aparelho. */
function nomeSalvo(): string {
  try { return localStorage.getItem("drumcam-nome") || "Câmera do celular"; } catch { return "Câmera do celular"; }
}

/** Sessão atual, para a página da câmera em segundo plano entrar quando o aparelho não tem o token do app. */
function sessaoAtual(): string {
  try { const s = lerSessao(sessionStorage); return s ? JSON.stringify(s) : ""; } catch { return ""; }
}

/** App 11.0: acompanha a câmera em segundo plano deste celular (liga, desliga e o estado contado pela página dela). */
function useCameraServico() {
  const [ponte] = useState(() => ponteCameraServico());
  const [estado, setEstado] = useState<EstadoCameraServico | null>(() => ponte?.estado() ?? null);
  useEffect(() => {
    if (!ponte) return;
    const ler = () => setEstado(ponte.estado());
    const t = setInterval(ler, 1_500);
    window.addEventListener("nord-camera-servico", ler);
    window.addEventListener("focus", ler);
    return () => { clearInterval(t); window.removeEventListener("nord-camera-servico", ler); window.removeEventListener("focus", ler); };
  }, [ponte]);
  return {
    disponivel: ponte !== null,
    estado,
    ligar: () => { ponte?.ligar(nomeSalvo(), sessaoAtual()); setTimeout(() => ponte && setEstado(ponte.estado()), 400); },
    desligar: () => { ponte?.desligar(); setTimeout(() => ponte && setEstado(ponte.estado()), 300); },
  };
}

/** Faixa "Este celular está como câmera": fica no ar mesmo com o app fechado e só sai em "Desligar câmera". */
function FaixaCameraServico({ estado, desligar }: { estado: EstadoCameraServico; desligar: () => void }) {
  const c = estado.camera;
  const noAr = c?.rele === "conectado";
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm" role="status" aria-label="Este celular está como câmera">
      <span className={`h-2.5 w-2.5 rounded-full ${noAr ? "animate-pulse bg-red-500" : "bg-amber-400"}`} />
      <span className="min-w-0 flex-1">
        <b className="text-white">Este celular está como câmera</b>{c?.nome ? ` · ${c.nome}` : ""}
        <span className="block text-xs text-slate-300">
          {c?.erro ?? (noAr ? `No ar · ${c?.vendo ?? 0} vendo${c?.gravando ? " · gravando em alta qualidade" : ""}` : "Conectando…")}
          {" · "}Pode usar o NordTool e fechar o app: a câmera só desliga aqui ou pelo Monitoramento.
          {!estado.janela && " Sem \"Aparecer sobre outros apps\", alguns celulares podem desligar a câmera com o app fechado."}
        </span>
      </span>
      <button type="button" onClick={desligar} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500">
        <Power className="h-4 w-4" />Desligar câmera
      </button>
    </div>
  );
}

function Mesa() {
  const { estado, cameras } = useAoVivo();
  const [aba, setAba] = useState<Aba>(() => {
    try { return (localStorage.getItem("drumcam-aba") as Aba) || "estudio"; } catch { return "estudio"; }
  });
  const [sendoCamera, setSendoCamera] = useState(false);
  const servico = useCameraServico();
  // No app 11.0+, "Ser câmera" liga a câmera em segundo plano (o celular fica livre); fora dele, abre a tela da câmera.
  const serCamera = () => (servico.disponivel ? servico.ligar() : setSendoCamera(true));
  const cameraLigadaAqui = servico.estado?.ligada === true;
  const [abrirNaGaleria, setAbrirNaGaleria] = useState<string | null>(null);
  const aoVivo = cameras.filter(c => c.tipo === "aovivo").length;
  const limparAbrir = useCallback(() => setAbrirNaGaleria(null), []);
  const mudar = (a: Aba) => { setAba(a); try { localStorage.setItem("drumcam-aba", a); } catch { /* sem armazenamento */ } };

  return (
    <div className="rounded-xl bg-[#0f1115] p-2 text-slate-200 shadow-xl ring-1 ring-black/40 sm:p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <p className="mr-2 flex items-center gap-2 text-sm font-black tracking-wide text-white">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-red-600"><Radio className="h-4 w-4" /></span>Gravação
        </p>
        <nav className="flex flex-1 flex-wrap gap-1 rounded-lg bg-black/30 p-1" role="tablist" aria-label="Gravação">
          {ABAS.map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => mudar(a.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${aba === a.id ? "bg-[#2a2f3a] text-white shadow" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
              <a.icone className="h-4 w-4" />{a.nome}
            </button>
          ))}
        </nav>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${estado === "conectado" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
          {estado === "conectado" ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : <Loader2 className="h-3 w-3 animate-spin" />}
          {estado === "conectado" ? `${aoVivo} câmera${aoVivo === 1 ? "" : "s"} ao vivo` : "conectando…"}
        </span>
        {!cameraLigadaAqui && (
          <button type="button" onClick={serCamera}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500">
            <Smartphone className="h-4 w-4" />Ser câmera
          </button>
        )}
      </header>
      {cameraLigadaAqui && servico.estado && <FaixaCameraServico estado={servico.estado} desligar={servico.desligar} />}

      {/* Sendo câmera, este aparelho não abre o estúdio por trás (não se conecta a si mesmo nem gasta bateria). */}
      {!sendoCamera && <Suspense fallback={<p className="grid h-60 place-items-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></p>}>
        {aba === "estudio" && <EstudioDrumcam aoGravar={id => setAbrirNaGaleria(id)} />}
        {aba === "monitor" && <MonitorDrumcam />}
        {aba === "galeria" && <GaleriaDrumcam abrir={abrirNaGaleria} aoAbrir={limparAbrir} />}
        {aba === "cameras" && <Cameras serCamera={serCamera} />}
      </Suspense>}
      {abrirNaGaleria && aba === "estudio" && (
        <button type="button" onClick={() => mudar("galeria")} className="fixed bottom-4 right-4 z-[70] rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-sky-500">
          Gravação salva · ver na Galeria
        </button>
      )}
      {sendoCamera && <CameraAoVivoTela sair={() => setSendoCamera(false)} />}
    </div>
  );
}

function Cameras({ serCamera }: { serCamera: () => void }) {
  const { cameras } = useAoVivo();
  return (
    <div className="space-y-3">
      <section className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <button type="button" onClick={serCamera} className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left hover:bg-red-500/20">
          <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
          <span><span className="block font-bold text-white">Usar este aparelho como câmera ao vivo</span>
            <span className="block text-xs text-slate-400">Celular (no app NordTool 11.0+ a câmera roda em segundo plano: o celular fica livre e ela segue com o app fechado; no navegador, com a tela ligada) ou notebook com webcam. Aparece na Mesa e no Monitoramento de qualquer aparelho da sua conta. Deixe na tomada.</span></span>
        </button>
        <div className="rounded-lg border border-white/10 bg-[#181b22] p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Na sua conta agora</p>
          {cameras.length === 0 ? <p className="text-xs text-slate-500">Nenhuma câmera ligada.</p> : (
            <ul className="space-y-1">
              {cameras.map(c => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />{c.nome}
                  <span className="ml-auto rounded bg-white/10 px-1.5 text-[10px] text-slate-300">{c.tipo === "aovivo" ? "ao vivo" : "app (YouTube)"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="rounded-lg border border-white/10 bg-[#181b22] p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Câmera do app (grava no celular e publica no YouTube)</p>
        <DrumcamClassico />
      </section>
    </div>
  );
}
