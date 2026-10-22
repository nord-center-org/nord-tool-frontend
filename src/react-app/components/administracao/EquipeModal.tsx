import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Network, X } from "lucide-react";

import { acessoService, type AcessoCargo, type Acessos, type NivelAcesso } from "@/react-app/services/AcessoService";
import { MODULOS, NIVEIS, ROTULO_NIVEL, abaixoDe, arvoreHierarquia, completar, nomeModulo } from "@/react-app/utils/acessos";

interface Props { onFechar: () => void }
type Aba = "hierarquia" | "cargos";

/** Equipe: quem está abaixo de quem e o pacote mínimo de acessos de cada cargo. */
export default function EquipeModal({ onFechar }: Props) {
  const [dados, setDados] = useState<Acessos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("hierarquia");

  const carregar = useCallback(async () => {
    setErro(null);
    try { setDados(await acessoService.listar()); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar."); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Equipe e cargos" className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-xl sm:h-[85vh] sm:rounded-3xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Network className="h-5 w-5 text-blue-600" />
          <div className="mr-auto">
            <h2 className="text-lg font-bold text-slate-800">Equipe e cargos</h2>
            <p className="text-xs text-slate-500">Quem está abaixo de quem e os acessos mínimos de cada cargo.</p>
          </div>
          <div role="tablist" className="flex rounded-xl bg-slate-100 p-0.5">
            {(["hierarquia", "cargos"] as Aba[]).map(a => (
              <button key={a} role="tab" aria-selected={aba === a} type="button" onClick={() => setAba(a)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${aba === a ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                {a === "hierarquia" ? "Hierarquia" : "Acessos por cargo"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        {!dados ? (
          <div className="flex flex-1 items-center justify-center p-8">
            {erro ? <p role="alert" className="text-sm text-red-700">{erro}</p> : <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />}
          </div>
        ) : aba === "hierarquia" ? <Hierarquia dados={dados} onAtualizar={setDados} /> : <Cargos dados={dados} onAtualizar={setDados} />}
      </div>
    </div>
  );
}

function Hierarquia({ dados, onAtualizar }: { dados: Acessos; onAtualizar: (d: Acessos) => void }) {
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativos = useMemo(() => dados.usuarios.filter(u => u.inAtivo && u.cdSituacaoCadastro !== "PENDENTE"), [dados]);
  const linhas = useMemo(() => arvoreHierarquia(ativos), [ativos]);

  const definir = async (id: number, idSuperior: number | null) => {
    setSalvando(id); setErro(null);
    try {
      await acessoService.definirSuperior(id, idSuperior);
      onAtualizar({ ...dados, usuarios: dados.usuarios.map(u => (u.id === id ? { ...u, idSuperior } : u)) });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {erro && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4" aria-label="Hierarquia">
        {linhas.map(({ item: u, nivel }) => {
          const proibidos = abaixoDe(ativos, u.id);
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5" style={{ paddingLeft: `${Math.min(nivel, 6) * 1.25}rem` }}>
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-sm font-semibold text-slate-700">{nivel > 0 && <span className="mr-1 text-slate-300">└</span>}{u.nmNome}</p>
                <p className="text-xs text-slate-400">{u.nmCargo ?? "sem cargo"}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">Responde a
                <select aria-label={`Superior de ${u.nmNome}`} value={u.idSuperior ?? ""} disabled={salvando === u.id}
                  onChange={e => void definir(u.id, e.target.value === "" ? null : Number(e.target.value))}
                  className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
                  <option value="">Ninguém (topo)</option>
                  {ativos.filter(o => o.id !== u.id && !proibidos.has(o.id)).map(o => <option key={o.id} value={o.id}>{o.nmNome}</option>)}
                </select>
              </label>
              {salvando === u.id && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Cargos({ dados, onAtualizar }: { dados: Acessos; onAtualizar: (d: Acessos) => void }) {
  const cargos = dados.cargos ?? [];
  const [idCargo, setIdCargo] = useState<number | null>(cargos[0]?.idCargo ?? null);
  const cargo = cargos.find(c => c.idCargo === idCargo) ?? null;
  const [rascunho, setRascunho] = useState<Record<string, NivelAcesso>>(() => completar(dados.modulos, cargo?.acessos));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const original = completar(dados.modulos, cargo?.acessos);
  const sujo = dados.modulos.some(m => rascunho[m] !== original[m]);
  const qtPessoas = dados.usuarios.filter(u => u.idCargo === idCargo).length;

  const escolher = (c: AcessoCargo) => {
    if (sujo && !window.confirm("Descartar as alterações deste cargo?")) return;
    setIdCargo(c.idCargo); setRascunho(completar(dados.modulos, c.acessos)); setOk(false); setErro(null);
  };

  const salvar = async () => {
    if (idCargo === null) return;
    setSalvando(true); setErro(null); setOk(false);
    try {
      const novo = await acessoService.salvarCargo(idCargo, rascunho);
      onAtualizar({ ...dados, cargos: cargos.map(c => (c.idCargo === novo.idCargo ? novo : c)) });
      setOk(true);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar o cargo.");
    } finally {
      setSalvando(false);
    }
  };

  if (cargos.length === 0) {
    return <p className="p-8 text-center text-sm text-slate-400">Nenhum cargo cadastrado. Cadastre os cargos em Configurações › Cadastros.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ul className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 p-2 md:w-56 md:flex-col md:border-b-0 md:border-r" aria-label="Cargos">
        {cargos.map(c => (
          <li key={c.idCargo}>
            <button type="button" onClick={() => escolher(c)} aria-current={c.idCargo === idCargo}
              className={`w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-semibold ${c.idCargo === idCargo ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-50"}`}>
              {c.nmCargo}
            </button>
          </li>
        ))}
      </ul>
      <section className="flex min-h-0 flex-1 flex-col" aria-label={`Acessos do cargo ${cargo?.nmCargo ?? ""}`}>
        <p className="px-4 pt-3 text-xs text-slate-500">Todo usuário com o cargo <strong>{cargo?.nmCargo}</strong> ({qtPessoas} pessoa(s)) recebe pelo menos estes acessos. Exceções por pessoa ficam em Acessos.</p>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4">
          {dados.modulos.map(m => (
            <li key={m} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-sm font-semibold text-slate-700">{nomeModulo(m)}</p>
                {MODULOS[m] && <p className="text-xs text-slate-400">{MODULOS[m].telas}</p>}
              </div>
              <div role="radiogroup" aria-label={`Nível do cargo em ${nomeModulo(m)}`} className="flex rounded-xl bg-slate-100 p-0.5">
                {NIVEIS.map(n => (
                  <button key={n} type="button" role="radio" aria-checked={rascunho[m] === n} onClick={() => setRascunho({ ...rascunho, [m]: n })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${rascunho[m] === n ? (n === "NENHUM" ? "bg-white text-slate-600 shadow-sm" : "bg-blue-600 text-white shadow-sm") : "text-slate-500"}`}>
                    {ROTULO_NIVEL[n]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3">
          {erro && <p role="alert" className="mr-auto text-sm text-red-700">{erro}</p>}
          {ok && !sujo && <p role="status" className="mr-auto flex items-center gap-1 text-sm text-green-700"><Check className="h-4 w-4" /> Cargo salvo. Quem tem o cargo entra de novo com os acessos novos.</p>}
          <button type="button" disabled={!sujo || salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar cargo
          </button>
        </footer>
      </section>
    </div>
  );
}
