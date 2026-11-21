import { Smartphone, Wifi, WifiOff, X } from "lucide-react";
import { lerAvatar } from "@/react-app/utils/avatar";
import { linkDoControle, MAX_JOGADORES_SALA, type JogadorSala } from "@/react-app/utils/games/sala";
import type { EstadoConexao } from "../rede/ClienteSala";
import AvatarCorpo from "./AvatarCorpo";
import QrCode from "./QrCode";

/** Sala aberta (no painel do jogo): QR Code, código e quem já entrou pelo celular. */
export default function SalaPainel({ codigo, estado, jogadores, euJogo, onEuJogo, onFechar }: {
  codigo: string; estado: EstadoConexao; jogadores: JogadorSala[]; euJogo: boolean; onEuJogo: (v: boolean) => void; onFechar: () => void;
}) {
  const link = linkDoControle(window.location.origin, codigo);
  const celulares = jogadores.filter(j => j.vaga > 0);
  return (
    <div className="space-y-3 rounded-2xl bg-cyan-400/5 p-4 ring-1 ring-cyan-300/20" data-tutorial="games-sala">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-cyan-200"><Smartphone className="h-4 w-4" />Sala aberta</h3>
          <p className="text-xs text-white/60">Cada um lê o QR Code (ou abre Games → Controle e digita o código). Até {MAX_JOGADORES_SALA} jogadores.</p>
        </div>
        <button type="button" onClick={onFechar} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10"><X className="h-4 w-4" />Fechar sala</button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(34,211,238,.35)]"><QrCode texto={link} tamanho={140} rotulo={`QR Code da sala ${codigo}`} /></div>
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300/70">Código</p>
          <p className="font-mono text-4xl font-black tracking-[0.25em] text-white drop-shadow-[0_0_12px_rgba(34,211,238,.6)]" aria-label="Código da sala">{codigo}</p>
          <p className={`flex items-center gap-1 text-xs font-bold ${estado === "conectado" ? "text-lime-300" : "text-amber-300"}`} aria-live="polite">
            {estado === "conectado" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {estado === "conectado" ? "Tela conectada" : estado === "fechada" ? "Sala fechada" : "Conectando…"}
          </p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Celulares na sala">
        {celulares.length === 0 && <li className="text-xs text-white/50">Ninguém entrou ainda.</li>}
        {celulares.map(j => (
          <li key={j.vaga} className={`flex items-end gap-1 rounded-xl bg-white/5 px-2 pt-1 text-xs font-bold text-white ring-1 ring-white/10 ${j.conectado ? "" : "opacity-40"}`}>
            <AvatarCorpo config={lerAvatar(j.avatar, j.idUsuario)} altura={42} atraso={j.vaga * 0.3} /><span className="pb-1">{j.nome.split(" ")[0]}{j.conectado ? "" : " (caiu)"}</span>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs font-bold text-white/80">
        <input type="checkbox" checked={euJogo} onChange={e => onEuJogo(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
        Eu também jogo nesta tela (teclado)
      </label>
    </div>
  );
}
