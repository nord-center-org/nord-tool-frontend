import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { acessoService, type AcessoUsuario } from "@/react-app/services/AcessoService";

interface Opcao { id: number; nome: string }

interface DadosUsuarioProps {
  usuario: AcessoUsuario;
  empresas: Opcao[];
  cargos: Opcao[];
  onSalvo: (u: AcessoUsuario) => void;
}

const classe = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";

/** Nome, celular, empresa e cargo do usuário (base única de usuários). */
export default function DadosUsuario({ usuario, empresas, cargos, onSalvo }: DadosUsuarioProps) {
  const [nome, setNome] = useState(usuario.nmNome);
  const [celular, setCelular] = useState(usuario.nrCelular ?? "");
  const [idEmpresa, setIdEmpresa] = useState<number | "">(usuario.idEmpresa ?? "");
  const [idCargo, setIdCargo] = useState<number | "">(usuario.idCargo ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const sujo = nome !== usuario.nmNome || celular !== (usuario.nrCelular ?? "")
    || idEmpresa !== (usuario.idEmpresa ?? "") || idCargo !== (usuario.idCargo ?? "");

  const salvar = async () => {
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true); setErro(null); setOk(false);
    try {
      onSalvo(await acessoService.salvarDados(usuario.id, {
        nmNome: nome.trim(), nrCelular: celular.trim(),
        idEmpresa: idEmpresa === "" ? null : idEmpresa, idCargo: idCargo === "" ? null : idCargo,
      }));
      setOk(true);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar os dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <details className="mx-4 mt-3 rounded-2xl border border-slate-200 open:pb-3">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-slate-700">
        Dados do usuário <span className="font-normal text-slate-400">· {[usuario.nmCargo, usuario.nmEmpresa].filter(Boolean).join(" · ") || "sem cargo e empresa"}</span>
      </summary>
      <div className="grid gap-3 px-4 sm:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome
          <input value={nome} maxLength={150} onChange={e => setNome(e.target.value)} className={`${classe} mt-1`} />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Celular
          <input value={celular} maxLength={20} inputMode="tel" placeholder="(11) 99999-9999" onChange={e => setCelular(e.target.value)} className={`${classe} mt-1`} />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Empresa
          <select value={idEmpresa} onChange={e => setIdEmpresa(e.target.value === "" ? "" : Number(e.target.value))} className={`${classe} mt-1`}>
            <option value="">—</option>
            {empresas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo
          <select value={idCargo} onChange={e => setIdCargo(e.target.value === "" ? "" : Number(e.target.value))} className={`${classe} mt-1`}>
            <option value="">—</option>
            {cargos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 px-4">
        {erro && <p role="alert" className="mr-auto text-sm text-red-700">{erro}</p>}
        {ok && !sujo && <span role="status" className="flex items-center gap-1 text-sm text-green-700"><Check className="h-4 w-4" /> Dados salvos</span>}
        <button type="button" onClick={() => void salvar()} disabled={!sujo || salvando} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar dados
        </button>
      </div>
    </details>
  );
}
