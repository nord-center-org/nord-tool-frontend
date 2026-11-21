import { Smartphone, Wifi, WifiOff, X } from "lucide-react";
import Avatar from "@/react-app/components/avatar/Avatar";
import { lerAvatar } from "@/react-app/utils/avatar";
import { linkDoControle, MAX_JOGADORES_SALA, type JogadorSala } from "@/react-app/utils/games/sala";
import type { EstadoConexao } from "../rede/ClienteSala";
import QrCode from "./QrCode";

/** Sala aberta na tela grande: QR Code, código e quem já entrou pelo celular. */
export default function SalaPainel({ codigo, estado, jogadores, euJogo, onEuJogo, onFechar }: {
  codigo: string; estado: EstadoConexao; jogadores: JogadorSala[]; euJogo: boolean; onEuJogo: (v: boolean) => void; onFechar: () => void;
}) {
  const link = linkDoControle(window.location.origin, codigo);
  const celulares = jogadores.filter(j => j.vaga > 0);
  return (
    <div className="space-y-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100" data-tutorial="games-sala">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-black text-indigo-900"><Smartphone className="h-4 w-4" />Sala aberta</h3>
          <p className="text-xs text-indigo-700">Cada um lê o QR Code (ou abre Games → Controle e digita o código). Até {MAX_JOGADORES_SALA} jogadores.</p>
        </div>
        <button type="button" onClick={onFechar} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><X className="h-4 w-4" />Fechar sala</button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <QrCode texto={link} tamanho={148} rotulo={`QR Code da sala ${codigo}`} />
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Código</p>
          <p className="font-mono text-4xl font-black tracking-[0.25em] text-indigo-950" aria-label="Código da sala">{codigo}</p>
          <p className={`flex items-center gap-1 text-xs font-bold ${estado === "conectado" ? "text-emerald-700" : "text-amber-700"}`} aria-live="polite">
            {estado === "conectado" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {estado === "conectado" ? "Tela conectada" : estado === "fechada" ? "Sala fechada" : "Conectando…"}
          </p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Celulares na sala">
        {celulares.length === 0 && <li className="text-xs text-indigo-700">Ninguém entrou ainda.</li>}
        {celulares.map(j => (
          <li key={j.vaga} className={`flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-indigo-100 ${j.conectado ? "" : "opacity-50"}`}>
            <Avatar config={lerAvatar(j.avatar, j.idUsuario)} tamanho={22} semFundo />{j.nome.split(" ")[0]}{j.conectado ? "" : " (caiu)"}
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs font-bold text-indigo-900">
        <input type="checkbox" checked={euJogo} onChange={e => onEuJogo(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
        Eu também jogo nesta tela (teclado)
      </label>
    </div>
  );
}
