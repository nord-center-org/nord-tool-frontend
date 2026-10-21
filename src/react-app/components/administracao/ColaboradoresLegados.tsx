import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { acessoService, type AcessoUsuario, type ColaboradorLegado } from "@/react-app/services/AcessoService";

interface Props {
  usuarios: AcessoUsuario[];
  onVoltar: () => void;
}

/** Liga cada colaborador da base antiga a um usuário, para o histórico de chaves continuar com o nome certo. */
export default function ColaboradoresLegados({ usuarios, onVoltar }: Props) {
  const [lista, setLista] = useState<ColaboradorLegado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);

  useEffect(() => {
    acessoService.listarLegados().then(setLista).catch(e => setErro(e instanceof Error ? e.message : "Falha ao carregar."));
  }, []);

  const vincular = async (c: ColaboradorLegado, idUsuario: number | null) => {
    setSalvando(c.idUser); setErro(null);
    try {
      const novo = await acessoService.vincular(c.idUser, idUsuario);
      // Um usuário só pode ter um colaborador antigo: o vínculo anterior dele some da lista.
      setLista(l => (l ?? []).map(x => (x.idUser === novo.idUser ? novo
        : idUsuario !== null && x.idUsuario === idUsuario ? { ...x, idUsuario: null, nmUsuario: null } : x)));
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível vincular.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Usuários</button>
        <p className="text-xs text-slate-500">Ligue cada colaborador antigo ao usuário dele. O histórico de chaves passa a mostrar o usuário.</p>
      </div>
      {erro && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {!lista ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4" aria-label="Colaboradores antigos">
          {lista.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Nenhum colaborador antigo.</li>}
          {lista.map(c => (
            <li key={c.idUser} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-semibold text-slate-700">{c.nmColaborador}</p>
                <p className="text-xs text-slate-400">{[c.nmCargo, c.nmEmpresa, `${c.qtRetiradas} retirada(s)`].filter(Boolean).join(" · ")}</p>
              </div>
              <select aria-label={`Usuário de ${c.nmColaborador}`} value={c.idUsuario ?? ""} disabled={salvando === c.idUser}
                onChange={e => void vincular(c, e.target.value === "" ? null : Number(e.target.value))}
                className={`rounded-xl border px-3 py-2 text-sm ${c.idUsuario ? "border-green-200 bg-green-50 text-green-800" : "border-slate-200 text-slate-600"}`}>
                <option value="">Sem vínculo</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nmNome}</option>)}
              </select>
              {salvando === c.idUser && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
