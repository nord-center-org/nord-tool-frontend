import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, Link2, Loader2, Plus, Search, Users, X } from "lucide-react";

import { acessoService, type AcessoUsuario } from "@/react-app/services/AcessoService";
import { obraService, type Fase, type Obra } from "@/react-app/services/ObraService";
import { filtrarUsuarios } from "@/react-app/utils/acessos";
import { alternarId, codigoValido, mesmosIds, ordenarFases, siglaValida, sugerirCodigo } from "@/react-app/utils/obras";

const classeCampo = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";
const classeInput = `w-full ${classeCampo}`;
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

interface ObrasModalProps { onFechar: () => void }

/** Cadastro de obras, fases e de quem participa de cada fase (só administradores). */
export default function ObrasModal({ onFechar }: ObrasModalProps) {
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [usuarios, setUsuarios] = useState<AcessoUsuario[]>([]);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<number | "nova" | null>(null);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try {
      const [lista, acessos] = await Promise.all([obraService.listar(), acessoService.listar()]);
      setObras(lista);
      setUsuarios(acessos.usuarios);
    } catch (e) {
      setErroCarga(mensagem(e, "Não foi possível carregar as obras."));
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const obra = typeof selecao === "number" ? obras?.find(o => o.id === selecao) ?? null : null;
  const substituirObra = (nova: Obra) => setObras(l => {
    const lista = l ?? [];
    return lista.some(o => o.id === nova.id) ? lista.map(o => (o.id === nova.id ? nova : o)) : [...lista, nova];
  });
  const substituirFase = (f: Fase) => setObras(l => (l ?? []).map(o => o.id !== f.idObra ? o : {
    ...o, fases: o.fases.some(x => x.id === f.id) ? o.fases.map(x => (x.id === f.id ? f : x)) : [...o.fases, f],
  }));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Obras e fases" className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-xl sm:h-[85vh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Obras e fases</h2>
              <p className="text-xs text-slate-500">Cadastre as obras, as fases e quem participa de cada fase.</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>

        {!obras ? (
          <div className="flex flex-1 items-center justify-center p-8">
            {erroCarga ? (
              <div role="alert" className="text-center">
                <p className="text-sm text-red-700">{erroCarga}</p>
                <button type="button" onClick={() => void carregar()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Tentar novamente</button>
              </div>
            ) : <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside className={`${selecao !== null ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-100 md:w-72`} aria-label="Obras">
              <div className="p-3">
                <button type="button" onClick={() => setSelecao("nova")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Nova obra</button>
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {obras.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nenhuma obra cadastrada.</li>}
                {obras.map(o => (
                  <li key={o.id}>
                    <button type="button" onClick={() => setSelecao(o.id)} aria-current={selecao === o.id}
                      className={`w-full rounded-xl px-3 py-2.5 text-left ${selecao === o.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}>
                      <span className={`block truncate text-sm font-semibold ${o.inAtivo ? "text-slate-800" : "text-slate-400 line-through"}`}>{o.nmObra}</span>
                      <span className="block text-xs text-slate-400">{o.fases.length} fase(s) · código {o.cdAcesso}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <LigarApartamentos />
            </aside>

            <section className={`${selecao !== null ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-y-auto`} aria-label="Obra">
              {selecao === null ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-400">Selecione uma obra ou crie uma nova.</div>
              ) : (
                <div className="space-y-6 p-4">
                  <button type="button" onClick={() => setSelecao(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 md:hidden"><ArrowLeft className="h-4 w-4" /> Obras</button>
                  <EditorObra key={obra?.id ?? "nova"} obra={obra} onSalva={o => { substituirObra(o); setSelecao(o.id); }} />
                  {obra && (
                    <div>
                      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Fases</h3>
                      <ul className="space-y-2" aria-label="Fases">
                        {ordenarFases(obra.fases).map(f => <LinhaFase key={f.id} fase={f} usuarios={usuarios} onSalva={substituirFase} />)}
                      </ul>
                      <NovaFase idObra={obra.id} proximaOrdem={obra.fases.length + 1} onCriada={substituirFase} />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function EditorObra({ obra, onSalva }: { obra: Obra | null; onSalva: (o: Obra) => void }) {
  const [nome, setNome] = useState(obra?.nmObra ?? "");
  const [codigo, setCodigo] = useState(obra?.cdAcesso ?? "");
  const [ativo, setAtivo] = useState(obra?.inAtivo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const sujo = !obra || nome !== obra.nmObra || codigo !== obra.cdAcesso || ativo !== obra.inAtivo;

  const salvar = async () => {
    if (!nome.trim()) return setErro("Informe o nome da obra.");
    if (!codigoValido(codigo)) return setErro("O código deve ter de 4 a 20 letras, números ou hífen.");
    setSalvando(true); setErro(null); setOk(false);
    try {
      const form = { nmObra: nome.trim(), cdAcesso: codigo.trim().toUpperCase(), inAtivo: ativo, nrVersao: obra?.nrVersao };
      onSalva(obra ? await obraService.alterarObra(obra.id, form) : await obraService.criarObra(form));
      setOk(true);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar a obra."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); void salvar(); }} className="space-y-3 rounded-2xl border border-slate-200 p-4" aria-label="Dados da obra">
      <h3 className="text-base font-bold text-slate-800">{obra ? "Dados da obra" : "Nova obra"}</h3>
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome da obra
          <input autoFocus={!obra} value={nome} maxLength={120} onChange={e => setNome(e.target.value)} className={`${classeInput} mt-1`} />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Código de acesso (cadastro)
          <div className="mt-1 flex gap-2">
            <input value={codigo} maxLength={20} onChange={e => setCodigo(e.target.value.toUpperCase())} className={classeInput} />
            <button type="button" onClick={() => setCodigo(sugerirCodigo(nome))} disabled={!nome.trim()} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold normal-case tracking-normal text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sugerir</button>
          </div>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Obra ativa
        </label>
        <div className="flex items-center gap-3">
          {ok && !sujo && <span role="status" className="flex items-center gap-1 text-sm text-green-700"><Check className="h-4 w-4" /> Salvo</span>}
          <button type="submit" disabled={salvando || !sujo} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {obra ? "Salvar obra" : "Criar obra"}
          </button>
        </div>
      </div>
    </form>
  );
}

function LinhaFase({ fase, usuarios, onSalva }: { fase: Fase; usuarios: AcessoUsuario[]; onSalva: (f: Fase) => void }) {
  const [nome, setNome] = useState(fase.nmFase);
  const [sigla, setSigla] = useState(fase.cdFase ?? "");
  const [ordem, setOrdem] = useState(String(fase.nrOrdem));
  const [ativo, setAtivo] = useState(fase.inAtivo);
  const [abrirEquipe, setAbrirEquipe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sujo = nome !== fase.nmFase || sigla !== (fase.cdFase ?? "") || ordem !== String(fase.nrOrdem) || ativo !== fase.inAtivo;

  const salvar = async () => {
    if (!nome.trim()) return setErro("Informe o nome da fase.");
    if (!siglaValida(sigla)) return setErro("A sigla deve ter até 10 letras ou números.");
    setSalvando(true); setErro(null);
    try {
      onSalva(await obraService.alterarFase(fase.id, { nmFase: nome.trim(), cdFase: sigla.trim(), nrOrdem: Number(ordem) || 0, inAtivo: ativo, nrVersao: fase.nrVersao }));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar a fase."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <li className="rounded-2xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Nome da fase" value={nome} maxLength={80} onChange={e => setNome(e.target.value)} className={`${classeCampo} min-w-[10rem] flex-1`} />
        <input aria-label="Sigla da fase" value={sigla} maxLength={10} placeholder="Sigla" onChange={e => setSigla(e.target.value.toUpperCase())} className={`${classeCampo} w-20`} />
        <input aria-label="Ordem da fase" inputMode="numeric" value={ordem} onChange={e => setOrdem(e.target.value.replace(/\D/g, ""))} className={`${classeCampo} w-16`} />
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Ativa
        </label>
        <button type="button" onClick={() => setAbrirEquipe(v => !v)} aria-expanded={abrirEquipe} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
          <Users className="h-3.5 w-3.5" /> Equipe ({fase.idsUsuarios.length})
        </button>
        {sujo && (
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
          </button>
        )}
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      {abrirEquipe && <EquipeDaFase fase={fase} usuarios={usuarios} onSalva={onSalva} />}
    </li>
  );
}

function EquipeDaFase({ fase, usuarios, onSalva }: { fase: Fase; usuarios: AcessoUsuario[]; onSalva: (f: Fase) => void }) {
  const [ids, setIds] = useState<number[]>(fase.idsUsuarios);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const visiveis = useMemo(() => filtrarUsuarios(usuarios, busca), [usuarios, busca]);
  const sujo = !mesmosIds(ids, fase.idsUsuarios);

  const salvar = async () => {
    setSalvando(true); setErro(null);
    try {
      onSalva(await obraService.definirUsuarios(fase.id, ids));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar a equipe."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3" aria-label={`Equipe de ${fase.nmFase}`}>
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário" aria-label="Buscar usuário da equipe" className="w-full text-sm outline-none" />
      </label>
      <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
        {visiveis.map(u => (
          <li key={u.id}>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
              <input type="checkbox" checked={ids.includes(u.id)} onChange={() => setIds(l => alternarId(l, u.id))} className="h-4 w-4 accent-blue-600" />
              <span className="truncate text-slate-700">{u.nmNome}</span>
            </label>
          </li>
        ))}
      </ul>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">{ids.length} selecionado(s)</span>
        <button type="button" disabled={!sujo || salvando} onClick={() => void salvar()} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar equipe
        </button>
      </div>
    </div>
  );
}

function NovaFase({ idObra, proximaOrdem, onCriada }: { idObra: number; proximaOrdem: number; onCriada: (f: Fase) => void }) {
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = async () => {
    if (!nome.trim()) return setErro("Informe o nome da fase.");
    if (!siglaValida(sigla)) return setErro("A sigla deve ter até 10 letras ou números.");
    setSalvando(true); setErro(null);
    try {
      onCriada(await obraService.criarFase(idObra, { nmFase: nome.trim(), cdFase: sigla.trim(), nrOrdem: proximaOrdem, inAtivo: true }));
      setNome(""); setSigla("");
    } catch (e) {
      setErro(mensagem(e, "Não foi possível criar a fase."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); void criar(); }} className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-3" aria-label="Nova fase">
      <input aria-label="Nome da nova fase" value={nome} maxLength={80} placeholder="Nova fase (ex.: Nord 1)" onChange={e => setNome(e.target.value)} className={`${classeCampo} min-w-[10rem] flex-1`} />
      <input aria-label="Sigla da nova fase" value={sigla} maxLength={10} placeholder="Sigla" onChange={e => setSigla(e.target.value.toUpperCase())} className={`${classeCampo} w-20`} />
      <button type="submit" disabled={salvando} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar fase
      </button>
      {erro && <p role="alert" className="w-full text-sm text-red-700">{erro}</p>}
    </form>
  );
}

/** Liga os apartamentos já cadastrados à fase cuja sigla começa o código (ex.: N1-01-0101 → N1). */
function LigarApartamentos() {
  const [ligando, setLigando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const ligar = async () => {
    setLigando(true);
    setAviso(null);
    try {
      const r = await obraService.vincularApartamentos();
      setAviso({ ok: true, texto: `${r?.qtLigados ?? 0} ligado(s). ${r?.qtSemFase ?? 0} continuam sem fase.` });
    } catch (e) {
      setAviso({ ok: false, texto: mensagem(e, "Não foi possível ligar os apartamentos.") });
    } finally {
      setLigando(false);
    }
  };

  return (
    <div className="border-t border-slate-100 p-3">
      <button type="button" onClick={() => void ligar()} disabled={ligando}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
        {ligando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Ligar apartamentos pela sigla
      </button>
      <p className="mt-1 text-[11px] text-slate-400">Usa o começo do código do apartamento (ex.: N1-…) para achar a fase.</p>
      {aviso && <p role={aviso.ok ? "status" : "alert"} className={`mt-2 text-xs ${aviso.ok ? "text-emerald-700" : "text-red-700"}`}>{aviso.texto}</p>}
    </div>
  );
}
