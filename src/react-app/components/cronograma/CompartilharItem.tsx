import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Share2, Users } from "lucide-react";

import { CronogramaSemanalService } from "@/react-app/services/CronogramaSemanalService";
import { alternarPessoa, comEquipe, filtrarPessoas, mesmosIds, resumoNomes, type PessoaCompartilhavel } from "@/react-app/utils/compartilhamento";

interface Props {
  idItem: number;
  idsAtuais: number[];
  onCompartilhado: (ids: number[]) => void;
}

/** Com quem o dono compartilha o compromisso/nota (quem recebe vê, mas só o dono altera). */
export default function CompartilharItem({ idItem, idsAtuais, onCompartilhado }: Props) {
  const [pessoas, setPessoas] = useState<PessoaCompartilhavel[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ids, setIds] = useState<number[]>(idsAtuais);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    CronogramaSemanalService.pessoas().then(setPessoas).catch(() => setPessoas([]));
  }, []);
  useEffect(() => { setIds(idsAtuais); }, [idsAtuais]);

  const visiveis = useMemo(() => filtrarPessoas(pessoas ?? [], busca), [pessoas, busca]);
  const temEquipe = (pessoas ?? []).some(p => p.inEquipe);
  const sujo = !mesmosIds(ids, idsAtuais);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await CronogramaSemanalService.compartilhar(idItem, ids);
      onCompartilhado(r?.idsCompartilhados ?? ids);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível compartilhar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          <Share2 size={14} className="mr-1 inline" />
          {idsAtuais.length ? <>Compartilhado com <b className="text-slate-200">{resumoNomes(idsAtuais, pessoas ?? [])}</b></> : "Só você vê este item"}
        </p>
        <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-bold text-violet-300 hover:bg-slate-800">
          {aberto ? "Fechar" : "Compartilhar"}
        </button>
      </div>
      {aberto && (
        <div className="mt-3 space-y-2 animate-entrada">
          {erro && <p role="alert" className="rounded-lg bg-red-950/40 px-2 py-1 text-xs text-red-300">{erro}</p>}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 text-slate-500" size={14} />
              <input aria-label="Buscar pessoa" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-violet-600" />
            </div>
            {temEquipe && (
              <button type="button" onClick={() => setIds(atual => comEquipe(atual, pessoas ?? []))} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700">
                <Users size={14} /> Minha equipe
              </button>
            )}
          </div>
          {pessoas === null ? <Loader2 className="mx-auto animate-spin text-violet-400" size={18} /> : (
            <ul className="max-h-44 space-y-0.5 overflow-y-auto" aria-label="Pessoas">
              {visiveis.map(p => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-800">
                    <input type="checkbox" checked={ids.includes(p.id)} onChange={() => setIds(atual => alternarPessoa(atual, p.id))} className="accent-violet-600" />
                    <span className="flex-1 truncate text-slate-200">{p.nmNome}</span>
                    {p.nmCargo && <span className="truncate text-slate-500">{p.nmCargo}</span>}
                    {p.inEquipe && <span className="rounded bg-violet-900/60 px-1.5 text-[10px] text-violet-200">equipe</span>}
                  </label>
                </li>
              ))}
              {visiveis.length === 0 && <li className="px-2 py-2 text-xs text-slate-500">Ninguém encontrado.</li>}
            </ul>
          )}
          <button type="button" onClick={() => void salvar()} disabled={!sujo || salvando} className="w-full rounded-lg bg-violet-600 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            {salvando ? "Salvando..." : `Salvar compartilhamento (${ids.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
