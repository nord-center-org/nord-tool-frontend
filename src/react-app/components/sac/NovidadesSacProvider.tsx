import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { X } from "lucide-react";

import AvatarDoAdm from "./AvatarDoAdm";
import { ContextoNovidadesSac, type NovidadesSacContexto } from "@/react-app/hooks/useNovidadesSac";
import { sacService, type Chamado } from "@/react-app/services/SacService";
import { rotuloStatus } from "@/react-app/utils/sac";

const INTERVALO_MS = 60_000;
const CHAVE_AVISADOS = "@NordTool:sac_avisados";

function lerAvisados(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(CHAVE_AVISADOS) ?? "[]") as string[]); } catch { return new Set(); }
}
function salvarAvisados(s: Set<string>) {
  try { sessionStorage.setItem(CHAVE_AVISADOS, JSON.stringify([...s].slice(-100))); } catch { /* sem armazenamento: avisa de novo, sem problema */ }
}
/** Uma novidade é o chamado na versão dele (nova resposta do mesmo chamado avisa de novo). */
const chaveDe = (c: Chamado) => `${c.id}@${c.dhAtualizacao}`;

/**
 * Novidades do SAC para o app todo: busca a cada minuto (e quando a janela volta ao foco) os chamados da pessoa com
 * resposta não vista e, para o ADMIN, quantos estão abertos. Uma novidade que chega aparece num aviso com o avatar
 * de quem respondeu (fora do Início e do SAC, que mostram do jeito deles).
 */
export default function NovidadesSacProvider({ children }: { children: ReactNode }) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [abertos, setAbertos] = useState<number | null>(null);
  const [aviso, setAviso] = useState<Chamado | null>(null);
  const avisados = useRef(lerAvisados());
  const location = useLocation();
  const navigate = useNavigate();

  const recarregar = useCallback(() => {
    sacService.novidades().then(n => { setChamados(n.chamados); setAbertos(n.abertos); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    recarregar();
    const t = window.setInterval(recarregar, INTERVALO_MS);
    const foco = () => { if (document.visibilityState === "visible") recarregar(); };
    document.addEventListener("visibilitychange", foco);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", foco); };
  }, [recarregar]);

  // Aviso flutuante só para novidade que ainda não foi avisada nesta sessão.
  useEffect(() => {
    if (location.pathname === "/" || location.pathname.startsWith("/sac")) return;
    const nova = chamados.find(c => !avisados.current.has(chaveDe(c)));
    if (!nova) return;
    chamados.forEach(c => avisados.current.add(chaveDe(c)));
    salvarAvisados(avisados.current);
    setAviso(nova);
  }, [chamados, location.pathname]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 12_000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const marcarVistos = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    setChamados(l => l.filter(c => !ids.includes(c.id)));
    await sacService.marcarVistos(ids).catch(() => undefined);
  }, []);

  const valor = useMemo<NovidadesSacContexto>(() => ({ chamados, abertos, recarregar, marcarVistos }), [chamados, abertos, recarregar, marcarVistos]);

  return (
    <ContextoNovidadesSac.Provider value={valor}>
      {children}
      {aviso && (
        <div role="status" data-sem-print
          className="fixed bottom-4 left-3 right-3 z-[65] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-surgir sm:left-auto sm:right-6">
          <AvatarDoAdm c={aviso} tamanho={48} />
          <button type="button" onClick={() => { setAviso(null); navigate(`/sac?chamado=${aviso.id}`); }} className="min-w-0 flex-1 text-left">
            <p className="text-sm font-bold text-slate-800">{aviso.nmUsuarioResposta ?? "Um administrador"} respondeu seu chamado</p>
            <p className="truncate text-xs text-slate-500">#{aviso.id} {aviso.nmTitulo} · {rotuloStatus(aviso.cdStatus)}</p>
          </button>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </ContextoNovidadesSac.Provider>
  );
}
