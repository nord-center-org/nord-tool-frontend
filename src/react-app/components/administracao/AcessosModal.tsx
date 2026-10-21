import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, ShieldCheck, UserX, X } from "lucide-react";

import { useAuth } from "@/react-app/hooks/useAuth";
import { acessoService, type Acessos, type AcessoUsuario } from "@/react-app/services/AcessoService";
import {
  MODULOS, NIVEIS, ROTULO_NIVEL, alterado, completar, filtrarUsuarios, nomeModulo, personalizados, qtModulosLiberados,
  type Nivel, type Rascunho,
} from "@/react-app/utils/acessos";

interface AcessosModalProps {
  onFechar: () => void;
}

const rascunhoDe = (u: AcessoUsuario, modulos: string[]): Rascunho =>
  ({ cdPerfil: u.cdPerfil, inAtivo: u.inAtivo, acessos: completar(modulos, u.acessos) });

/** Modal de Acessos: à esquerda os usuários, à direita perfil, situação e o nível de cada módulo. */
export default function AcessosModal({ onFechar }: AcessosModalProps) {
  const { usuario: logado } = useAuth();
  const [dados, setDados] = useState<Acessos | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try {
      setDados(await acessoService.listar());
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar os acessos.");
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const modulos = useMemo(() => dados?.modulos ?? [], [dados]);
  const selecionado = dados?.usuarios.find(u => u.id === idSelecionado) ?? null;
  const original = selecionado ? rascunhoDe(selecionado, modulos) : null;
  const sujo = !!(rascunho && original && alterado(rascunho, original));
  const perfilDoRascunho = dados?.perfis.find(p => p.cdPerfil === rascunho?.cdPerfil);
  const fogem = rascunho ? personalizados(rascunho.acessos, perfilDoRascunho?.acessos) : [];
  const ehEuMesmo = selecionado?.id === logado?.id;
  const visiveis = useMemo(() => filtrarUsuarios(dados?.usuarios ?? [], busca), [dados, busca]);

  const selecionar = (u: AcessoUsuario) => {
    if (sujo && !window.confirm("Descartar as alterações não salvas?")) return;
    setIdSelecionado(u.id);
    setRascunho(rascunhoDe(u, modulos));
    setErro(null);
    setSalvo(false);
  };

  /** Trocar o perfil aplica o padrão dele aos módulos (dá para ajustar depois). */
  const trocarPerfil = (cdPerfil: string) => {
    if (!rascunho) return;
    const perfil = dados?.perfis.find(p => p.cdPerfil === cdPerfil);
    setRascunho({ ...rascunho, cdPerfil, acessos: completar(modulos, perfil?.acessos) });
  };

  const definir = (modulo: string, nivel: Nivel) =>
    rascunho && setRascunho({ ...rascunho, acessos: { ...rascunho.acessos, [modulo]: nivel } });

  const salvar = async () => {
    if (!selecionado || !rascunho || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const novo = await acessoService.salvar(selecionado.id, rascunho);
      setDados(d => d && { ...d, usuarios: d.usuarios.map(u => (u.id === novo.id ? novo : u)) });
      setRascunho(rascunhoDe(novo, modulos));
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar os acessos.");
    } finally {
      setSalvando(false);
    }
  };

  const fechar = () => { if (!sujo || window.confirm("Descartar as alterações não salvas?")) onFechar(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Acessos" className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-xl sm:h-[85vh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Acessos</h2>
              <p className="text-xs text-slate-500">Escolha o usuário e o que ele pode ver. A mudança vale no próximo login dele.</p>
            </div>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>

        {!dados ? (
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
            {/* Lista de usuários (no celular some quando um usuário está aberto) */}
            <aside className={`${selecionado ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-100 md:w-80`} aria-label="Usuários">
              <div className="p-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário" aria-label="Buscar usuário" className="w-full text-sm outline-none" />
                </label>
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {visiveis.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nenhum usuário.</li>}
                {visiveis.map(u => {
                  const qt = qtModulosLiberados(u.acessos);
                  const ativo = u.id === idSelecionado;
                  return (
                    <li key={u.id}>
                      <button type="button" onClick={() => selecionar(u)} aria-current={ativo}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${ativo ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm font-semibold ${u.inAtivo ? "text-slate-800" : "text-slate-400 line-through"}`}>{u.nmNome}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${u.cdPerfil === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{u.cdPerfil}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="truncate">{u.nmEmail}</span>
                          {qt === 0 ? <span className="shrink-0 font-bold text-amber-600">Sem acesso</span> : <span className="shrink-0">{qt} módulo(s)</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Editor */}
            <section className={`${selecionado ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`} aria-label="Acessos do usuário">
              {!selecionado || !rascunho ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-400">Selecione um usuário à esquerda.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                    <button type="button" onClick={() => { if (!sujo || window.confirm("Descartar as alterações não salvas?")) setIdSelecionado(null); }} aria-label="Voltar para a lista" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"><ArrowLeft className="h-4 w-4" /></button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-800">{selecionado.nmNome}{ehEuMesmo && <span className="ml-2 text-xs font-semibold text-blue-600">(você)</span>}</p>
                      <p className="truncate text-xs text-slate-400">{selecionado.nmEmail}</p>
                    </div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perfil
                      <select value={rascunho.cdPerfil} onChange={e => trocarPerfil(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold normal-case tracking-normal text-slate-700">
                        {dados.perfis.map(p => <option key={p.cdPerfil} value={p.cdPerfil}>{p.nmPerfil}</option>)}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <input type="checkbox" checked={rascunho.inAtivo} disabled={ehEuMesmo} onChange={e => setRascunho({ ...rascunho, inAtivo: e.target.checked })} className="h-4 w-4 accent-blue-600" />
                      Ativo
                    </label>
                  </div>

                  {!rascunho.inAtivo && (
                    <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"><UserX className="h-4 w-4" /> Usuário inativo não consegue entrar no app.</p>
                  )}

                  <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4" aria-label="Módulos">
                    {modulos.map(m => {
                      const atual = rascunho.acessos[m] ?? "NENHUM";
                      return (
                        <li key={m} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="text-sm font-semibold text-slate-700">
                              {nomeModulo(m)}
                              {fogem.includes(m) && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">personalizado</span>}
                            </p>
                            {MODULOS[m] && <p className="text-xs text-slate-400">{MODULOS[m].telas}</p>}
                          </div>
                          <div role="radiogroup" aria-label={`Nível em ${nomeModulo(m)}`} className="flex rounded-xl bg-slate-100 p-0.5">
                            {NIVEIS.map(n => (
                              <button key={n} type="button" role="radio" aria-checked={atual === n} onClick={() => definir(m, n)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${atual === n ? (n === "NENHUM" ? "bg-white text-slate-600 shadow-sm" : "bg-blue-600 text-white shadow-sm") : "text-slate-500 hover:text-slate-700"}`}>
                                {ROTULO_NIVEL[n]}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-3">
                    {erro && <p role="alert" className="mr-auto text-sm text-red-700">{erro}</p>}
                    {salvo && !sujo && <p role="status" className="mr-auto flex items-center gap-1 text-sm text-green-700"><Check className="h-4 w-4" /> Acessos salvos.</p>}
                    <button type="button" disabled={!sujo || salvando} onClick={() => original && setRascunho(original)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Desfazer</button>
                    <button type="button" disabled={!sujo || salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
                      {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar acessos
                    </button>
                  </footer>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
