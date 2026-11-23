import { useEffect, useState } from "react";
import { Battery, Circle, Flashlight, Mic, MicOff, Moon, Pencil, Power, Users } from "lucide-react";
import { botoesDeZoom, duracaoTexto, type EstadoCamera } from "@/react-app/utils/drumcamAoVivo";
import { CameraLocal } from "./cameraLocal";
import type { EstadoRele } from "./rele";
import { BotaoIcone, VideoAoVivo } from "./ui";

function nomeSalvo(): string {
  try { return localStorage.getItem("drumcam-nome") || ""; } catch { return ""; }
}

/**
 * Este aparelho é uma câmera ao vivo (tela cheia). Transmite para o Estúdio e o Monitoramento de qualquer aparelho
 * da mesma conta. Mostra quantos estão vendo, a bateria e se está gravando em alta qualidade; dá para escurecer a
 * tela (economiza bateria e não chama atenção) sem parar a câmera. No app 9.0+ (v4), dá até para apagar a tela.
 */
export default function CameraAoVivoTela({ sair }: { sair: () => void }) {
  const [nome, setNome] = useState(() => nomeSalvo() || `Câmera ${Math.floor(Math.random() * 90 + 10)}`);
  const [estado, setEstado] = useState<EstadoCamera | null>(null);
  const [rele, setRele] = useState<EstadoRele>("conectando");
  const [vendo, setVendo] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escura, setEscura] = useState(false);
  const [editando, setEditando] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  // A câmera nasce e morre com a tela (no modo estrito do React, a tela monta duas vezes).
  const [camera, setCamera] = useState<CameraLocal | null>(null);
  useEffect(() => {
    const c = new CameraLocal(nome, { estado: setEstado, rele: setRele, espectadores: setVendo, stream: setStream, erro: setErro });
    setCamera(c);
    c.abrir().catch(err => setErro(err?.name === "NotAllowedError"
      ? "Sem permissão para a câmera. Libere a câmera e o microfone para o NordTool e tente de novo."
      : `Não deu para abrir a câmera: ${err?.message ?? err}`));
    try { localStorage.setItem("drumcam-nome", nome); } catch { /* sem armazenamento */ }
    return () => c.fechar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- a câmera nasce uma vez; o nome muda por renomear()
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);

  const fator = estado ? estado.lentes.find(l => l.id === estado.lente)?.fator ?? 1 : 1;
  const zoomAtual = fator * (estado?.zoom?.valor ?? 1);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <VideoAoVivo stream={stream} className="h-full w-full object-contain" />
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 bg-gradient-to-b from-black/80 to-transparent p-3 text-xs">
          <span className={`flex items-center gap-1.5 rounded-full px-2 py-1 font-bold ${rele === "conectado" ? "bg-emerald-600" : "bg-amber-600"}`}>
            <span className="h-2 w-2 rounded-full bg-white" />{rele === "conectado" ? "No ar" : "Conectando…"}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1"><Users className="h-3.5 w-3.5" />{vendo} vendo</span>
          {estado?.gravando && <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 font-bold"><Circle className="h-2.5 w-2.5 fill-current" />Gravando HQ {estado.gravandoDesde ? duracaoTexto((agora - estado.gravandoDesde) / 1000) : ""}</span>}
          {estado?.bateria != null && <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1"><Battery className="h-3.5 w-3.5" />{estado.bateria}%</span>}
          {estado && <span className="rounded-full bg-black/50 px-2 py-1">{estado.largura}×{estado.altura}</span>}
        </div>
        {erro && <p className="absolute inset-x-4 top-16 rounded-lg bg-red-600/90 p-3 text-sm">{erro}</p>}
        {!erro && camera && (
          <p className="absolute inset-x-3 top-12 text-center text-[11px] text-white/70">
            {camera.segundoPlano
              ? "Pode apagar a tela ou fechar o app: a câmera continua transmitindo até você tocar em Parar aqui (aviso nas notificações)."
              : "No navegador, a câmera precisa da tela ligada. No app NordTool 9.0+, ela continua com a tela apagada."}
          </p>
        )}
        {estado && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="flex gap-1 rounded-full bg-black/60 p-1">
              {botoesDeZoom(estado.zoom, estado.lentes).map(z => (
                <button key={z} type="button" onClick={() => void camera?.zoom(z)}
                  className={`h-9 min-w-10 rounded-full px-2 text-sm font-black ${Math.abs(zoomAtual - z) < 0.05 ? "bg-yellow-400 text-black" : "text-white hover:bg-white/15"}`}>
                  {String(z).replace(".", ",")}×
                </button>
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#181b22] p-3">
        {editando ? (
          <span className="flex flex-1 gap-1">
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} autoFocus aria-label="Nome desta câmera"
              onKeyDown={e => { if (e.key === "Enter") { camera?.renomear(nome); setEditando(false); } }}
              className="min-w-0 flex-1 rounded-md bg-black/50 px-2 py-1.5 text-sm" />
            <BotaoIcone rotulo="Salvar nome" ativo onClick={() => { camera?.renomear(nome); setEditando(false); }}>OK</BotaoIcone>
          </span>
        ) : (
          <button type="button" onClick={() => setEditando(true)} aria-label="Renomear esta câmera" className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-bold">
            <span className="truncate">{estado?.nome ?? nome}</span><Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        )}
        {estado && estado.lentes.length > 1 && (
          <select value={estado.lente} onChange={e => void camera?.abrir(e.target.value)} aria-label="Lente" className="h-8 rounded-md bg-white/10 px-2 text-xs">
            {estado.lentes.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>)}
          </select>
        )}
        {estado && <BotaoIcone rotulo={estado.microfone ? "Desligar microfone" : "Ligar microfone"} ativo={estado.microfone} onClick={() => camera?.ligarMicrofone(!estado.microfone)}>{estado.microfone ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</BotaoIcone>}
        {estado?.lanterna !== null && estado?.lanterna !== undefined && <BotaoIcone rotulo="Lanterna" ativo={estado.lanterna} onClick={() => void camera?.alternarLanterna(!estado.lanterna)}><Flashlight className="h-4 w-4" /></BotaoIcone>}
        <BotaoIcone rotulo="Escurecer a tela (a câmera continua)" onClick={() => setEscura(true)}><Moon className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo="Parar de ser câmera" perigo onClick={sair}><Power className="h-4 w-4" />Parar</BotaoIcone>
      </div>
      {escura && (
        <button type="button" onClick={() => setEscura(false)} aria-label="Acender a tela" className="fixed inset-0 z-[86] bg-black text-xs text-white/20">
          Câmera no ar · toque para acender
        </button>
      )}
    </div>
  );
}
