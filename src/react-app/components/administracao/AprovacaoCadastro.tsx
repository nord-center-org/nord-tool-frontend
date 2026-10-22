import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { acessoService, type AcessoUsuario } from "@/react-app/services/AcessoService";
import { obraService, type Obra } from "@/react-app/services/ObraService";
import { alternarId, ordenarFases } from "@/react-app/utils/obras";

interface Props {
  usuario: AcessoUsuario;
  onDecidido: (u: AcessoUsuario) => void;
}

/** Cadastro feito pela própria pessoa: o admin aprova (escolhendo as fases) ou recusa. */
export default function AprovacaoCadastro({ usuario, onDecidido }: Props) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [fases, setFases] = useState<number[]>([]);
  const [salvando, setSalvando] = useState<"aprovar" | "recusar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { obraService.listar().then(setObras).catch(() => setObras([])); }, []);
  const obra = obras.find(o => o.id === usuario.idObraSolicitada) ?? null;

  const decidir = async (aprovar: boolean) => {
    if (!aprovar && !window.confirm(`Recusar o cadastro de ${usuario.nmNome}? A pessoa não conseguirá entrar.`)) return;
    setSalvando(aprovar ? "aprovar" : "recusar"); setErro(null);
    try {
      onDecidido(await acessoService.decidirCadastro(usuario.id, aprovar, aprovar ? fases : []));
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar a decisão.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <section aria-label="Aprovação do cadastro" className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-bold text-amber-800">Cadastro aguardando aprovação</p>
      <p className="mt-1 text-sm text-amber-900/80">
        {usuario.nmNome} pediu entrada na obra <strong>{usuario.nmObraSolicitada ?? "—"}</strong>.
        {usuario.nrCelular && <> Celular: {usuario.nrCelular}.</>}
      </p>
      {obra && obra.fases.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Incluir nas fases</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {ordenarFases(obra.fases.filter(f => f.inAtivo)).map(f => (
              <label key={f.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${fases.includes(f.id) ? "border-blue-300 bg-white text-blue-700" : "border-amber-200 bg-white/60 text-slate-600"}`}>
                <input type="checkbox" checked={fases.includes(f.id)} onChange={() => setFases(l => alternarId(l, f.id))} className="h-4 w-4 accent-blue-600" />
                {f.nmFase}
              </label>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-amber-900/70">Ao aprovar, a pessoa entra sem nenhum módulo: libere os módulos logo abaixo.</p>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void decidir(false)} disabled={salvando !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
          {salvando === "recusar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Recusar
        </button>
        <button type="button" onClick={() => void decidir(true)} disabled={salvando !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
          {salvando === "aprovar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
        </button>
      </div>
    </section>
  );
}
