import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Check, KeyRound, Loader2, Mail, UserRound } from "lucide-react";

import { useAuth } from "@/react-app/hooks/useAuth";
import { authService } from "@/react-app/services/AuthService";
import { meusDadosService, type MeusDados } from "@/react-app/services/MeusDadosService";
import { OpcoesColaboradorService, type Empresa } from "@/react-app/services/OpcoesColaboradorService";

const campo = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500";
const rotulo = "block text-xs font-bold uppercase tracking-wider text-slate-500";

/**
 * Meus dados: cada pessoa preenche e altera o próprio nome, celular e empresa (como o administrador faz em Acessos,
 * mas só para si). O cargo aparece e só o administrador muda, porque é ele que dá os acessos; e-mail e senha têm as
 * telas deles.
 */
export default function MeusDadosPage() {
  const { atualizarSessao } = useAuth();
  const [dados, setDados] = useState<MeusDados | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [idEmpresa, setIdEmpresa] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    meusDadosService.ler().then(d => {
      setDados(d); setNome(d.nmNome); setCelular(d.nrCelular ?? ""); setIdEmpresa(d.idEmpresa ?? "");
    }).catch(e => setErro(e instanceof Error ? e.message : "Não deu para carregar os seus dados."));
    OpcoesColaboradorService.listarEmpresas().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  const mudou = !!dados && (nome.trim() !== dados.nmNome || celular.trim() !== (dados.nrCelular ?? "") || idEmpresa !== (dados.idEmpresa ?? ""));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null); setSalvo(false);
    if (!nome.trim()) return setErro("Informe o seu nome.");
    if (celular.trim() && !/^[0-9()+\- ]{8,20}$/.test(celular.trim())) return setErro("Celular inválido. Use só números, espaço, parênteses, + e -.");
    setSalvando(true);
    try {
      const d = await meusDadosService.salvar({ nmNome: nome.trim(), nrCelular: celular.trim(), idEmpresa: idEmpresa === "" ? null : idEmpresa });
      setDados(d); setNome(d.nmNome); setCelular(d.nrCelular ?? ""); setIdEmpresa(d.idEmpresa ?? "");
      // Token novo com o nome atualizado (o menu e o cabeçalho mostram na hora).
      try { atualizarSessao(await authService.refresh()); } catch { /* o nome novo aparece no próximo login */ }
      setSalvo(true);
    } catch (e2) {
      setErro(e2 instanceof Error && e2.message ? e2.message : "Não deu para salvar os seus dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-8">
      <form onSubmit={e => void enviar(e)} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" noValidate>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><UserRound className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Meus dados</h1>
            <p className="text-sm text-slate-500">O que aparece para a equipe e nos cadastros.</p>
          </div>
        </div>
        {!dados && !erro && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
        {dados && <>
          <label className={rotulo}>Nome completo
            <input value={nome} maxLength={150} onChange={e => { setNome(e.target.value); setSalvo(false); }} autoComplete="name" className={campo} />
          </label>
          <label className={rotulo}>Celular
            <input value={celular} maxLength={20} inputMode="tel" placeholder="(11) 99999-9999" autoComplete="tel"
              onChange={e => { setCelular(e.target.value); setSalvo(false); }} className={campo} />
          </label>
          <label className={rotulo}>Empresa
            <select value={idEmpresa} onChange={e => { setIdEmpresa(e.target.value ? Number(e.target.value) : ""); setSalvo(false); }} className={campo}>
              <option value="">Sem empresa</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nmEmpresa}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>Cargo
              <input value={dados.nmCargo ?? "Sem cargo"} disabled className={campo} />
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-slate-400">Quem define é o administrador (o cargo dá os acessos).</span>
            </label>
            <label className={rotulo}>E-mail de login
              <input value={dados.nmEmail} disabled className={campo} />
              <Link to="/conta/email" className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold normal-case tracking-normal text-blue-600 hover:underline"><Mail className="h-3 w-3" />Alterar e-mail</Link>
            </label>
          </div>
        </>}
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {salvo && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Check className="h-4 w-4" />Dados salvos.</p>}
        {dados && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/conta/senha" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700"><KeyRound className="h-4 w-4" />Alterar senha</Link>
            <button type="submit" disabled={!mudou || salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
