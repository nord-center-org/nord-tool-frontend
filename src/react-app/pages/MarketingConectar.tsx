import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { marketingService } from "@/react-app/services/MarketingService";
import { INFO_REDE, redeDoEstado } from "@/react-app/utils/marketing";

/**
 * Volta do login da rede (YouTube, Instagram ou TikTok): pega o código e o state da URL, conecta a conta no NordTool e
 * volta para Marketing → Contas.
 */
export default function MarketingConectarPage() {
  const [busca] = useSearchParams();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const estado = busca.get("state");
    const rede = redeDoEstado(estado);
    const codigo = busca.get("code");
    const recusa = busca.get("error_description") ?? busca.get("error_reason") ?? busca.get("error");
    if (recusa) { setErro(`A rede não autorizou: ${recusa}`); return; }
    if (!rede || !codigo || !estado) { setErro("Volta do login incompleta. Tente conectar de novo."); return; }
    marketingService.conectar(rede, codigo, estado)
      .then(c => navegar(`/gestao/marketing?aba=contas&conectada=${encodeURIComponent(`${INFO_REDE[rede].nome} ${c.txNome}`)}`, { replace: true }))
      .catch(e => setErro(e instanceof Error ? e.message : "Não deu para conectar a conta."));
  }, [busca, navegar]);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
      {erro ? (
        <>
          <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>
          <Link to="/gestao/marketing?aba=contas" className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white">Voltar para Contas</Link>
        </>
      ) : (
        <p className="flex items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Conectando a conta…</p>
      )}
    </div>
  );
}
