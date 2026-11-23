import { lazy, Suspense, useCallback, useState } from "react";
import { Camera, Clapperboard, FolderOpen, Loader2, MonitorPlay, Radio, Smartphone, Video } from "lucide-react";
import { ProvedorAoVivo, useAoVivo } from "./AoVivo";
import CameraAoVivoTela from "./CameraAoVivoTela";
import DrumcamClassico from "./DrumcamClassico";

const EstudioDrumcam = lazy(() => import("./EstudioDrumcam"));
const MonitorDrumcam = lazy(() => import("./MonitorDrumcam"));
const GaleriaDrumcam = lazy(() => import("./GaleriaDrumcam"));

type Aba = "estudio" | "monitor" | "galeria" | "cameras";
const ABAS: { id: Aba; nome: string; icone: typeof Video }[] = [
  { id: "estudio", nome: "Estúdio", icone: Clapperboard },
  { id: "monitor", nome: "Monitoramento", icone: MonitorPlay },
  { id: "galeria", nome: "Galeria", icone: FolderOpen },
  { id: "cameras", nome: "Câmeras", icone: Camera },
];

/**
 * Repertório → Estúdio (Drumcam v3): mesa de transmissão no estilo dos programas de live. Várias câmeras ao vivo
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

function Mesa() {
  const { estado, cameras } = useAoVivo();
  const [aba, setAba] = useState<Aba>(() => {
    try { return (localStorage.getItem("drumcam-aba") as Aba) || "estudio"; } catch { return "estudio"; }
  });
  const [sendoCamera, setSendoCamera] = useState(false);
  const [abrirNaGaleria, setAbrirNaGaleria] = useState<string | null>(null);
  const aoVivo = cameras.filter(c => c.tipo === "aovivo").length;
  const limparAbrir = useCallback(() => setAbrirNaGaleria(null), []);
  const mudar = (a: Aba) => { setAba(a); try { localStorage.setItem("drumcam-aba", a); } catch { /* sem armazenamento */ } };

  return (
    <div className="nt-estudio rounded-xl bg-[#0f1115] p-2 text-slate-200 shadow-xl ring-1 ring-black/40 sm:p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <p className="mr-2 flex items-center gap-2 text-sm font-black tracking-wide text-white">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-red-600"><Radio className="h-4 w-4" /></span>Estúdio
        </p>
        <nav className="flex flex-1 flex-wrap gap-1 rounded-lg bg-black/30 p-1" role="tablist" aria-label="Estúdio">
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
        <button type="button" onClick={() => setSendoCamera(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500">
          <Smartphone className="h-4 w-4" />Ser câmera
        </button>
      </header>

      {/* Sendo câmera, este aparelho não abre o estúdio por trás (não se conecta a si mesmo nem gasta bateria). */}
      {!sendoCamera && <Suspense fallback={<p className="grid h-60 place-items-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></p>}>
        {aba === "estudio" && <EstudioDrumcam aoGravar={id => setAbrirNaGaleria(id)} />}
        {aba === "monitor" && <MonitorDrumcam />}
        {aba === "galeria" && <GaleriaDrumcam abrir={abrirNaGaleria} aoAbrir={limparAbrir} />}
        {aba === "cameras" && <Cameras serCamera={() => setSendoCamera(true)} />}
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
            <span className="block text-xs text-slate-400">Celular (no app NordTool 8.0+ ou no navegador) ou notebook com webcam. Aparece no Estúdio e no Monitoramento de qualquer aparelho da sua conta. Deixe na tomada.</span></span>
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
