import { AlertTriangle, Box, ChevronDown, Filter, Lightbulb, ListChecks, Map as IconePlanta, Settings2, Upload, X } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";

import MenuCelula, { type AlvoCelula } from "./MenuCelula";
import ResumoProjeto from "./ResumoProjeto";
import type { Lado, Pavimento, ProjetoImportado } from "@/react-app/utils/escadinha";
import type { ResumoBlocos } from "@/react-app/utils/projetoVetorial";
import {
  COR_STATUS, LEGENDA, chaveCelula, gargalos, periodoDe, resumir, type Avaliacao, type Grade, type LinhaGrade, type ModeloEscadinha,
  type StatusMarcado,
} from "@/react-app/utils/escadinhaCury";

export type FiltroTorre = { tipo: "tudo" } | { tipo: "ciclo"; id: string } | { tipo: "atividade"; id: string };

interface PainelEscadinhaProps {
  modelo: ModeloEscadinha;
  linhas: LinhaGrade[];
  grade: Grade;
  avaliacao: Map<string, Avaliacao>;
  pavimentos: Pavimento[];
  selecionado: string | null;
  inicioObra: string | null;
  hoje: string;
  editavel: boolean;
  admin: boolean;
  filtro: FiltroTorre;
  onFiltro: (f: FiltroTorre) => void;
  onInicioObra: (iso: string | null) => void;
  onMarcar: (chaves: string[], status: StatusMarcado | "", data?: string) => void;
  onFocar: (idPavimento: string) => void;
  onVerTudo: () => void;
  onAnexar: () => void;
  onModelo: () => void;
  onFechar: () => void;
  /** Pavimento selecionado: abre a planta 2D. */
  onAbrirPlanta?: (idPavimento: string) => void;
  /** Pavimento selecionado: abre o pavimento em 3D (estado atual / apartamento modelo). */
  onVer3D?: (idPavimento: string) => void;
  /** Projeto importado da torre (blocos × alvenaria executada e o que falta). */
  projeto?: { dados: ProjetoImportado; resumo: ResumoBlocos } | null;
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ROTULO = Object.fromEntries(LEGENDA.map(l => [l.status, l.rotulo])) as Record<string, string>;

/** Painel ao lado do 3D: resumo e pontos de atenção da torre ou, com um pavimento aberto, as atividades por lado. */
export default function PainelEscadinha({
  modelo, linhas, grade, avaliacao, pavimentos, selecionado, inicioObra, hoje, editavel, admin, filtro, onFiltro, onInicioObra, onMarcar,
  onFocar, onVerTudo, onAnexar, onModelo, onFechar, projeto, onAbrirPlanta, onVer3D,
}: PainelEscadinhaProps) {
  const [lado, setLado] = useState<Lado>("A");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [alvo, setAlvo] = useState<AlvoCelula | null>(null);
  const resumo = useMemo(() => resumir(modelo, linhas, grade, avaliacao), [modelo, linhas, grade, avaliacao]);
  const pontos = useMemo(() => gargalos(modelo, linhas, avaliacao), [modelo, linhas, avaliacao]);
  const periodo = inicioObra ? periodoDe(inicioObra, hoje, modelo.diasPeriodo) : null;
  const pav = pavimentos.find(p => p.id === selecionado) ?? null;
  const naGrade = !!pav && linhas.some(l => l.pavimento.id === pav.id);
  const totalPavs = new Set(linhas.map(l => l.pavimento.id)).size;
  const atrasadas = resumo.contagem.atrasado + resumo.contagem.atrasoAnterior + resumo.contagem.atrasadoExec;
  const metas = [...avaliacao.values()].filter(a => a.meta).length;

  const valorFiltro = filtro.tipo === "tudo" ? "tudo" : `${filtro.tipo}:${filtro.id}`;
  const mudarFiltro = (v: string) => {
    if (v === "tudo") onFiltro({ tipo: "tudo" });
    else { const [tipo, id] = v.split(":"); onFiltro({ tipo: tipo as "ciclo" | "atividade", id }); }
  };
  const abrirMenu = (e: MouseEvent, idAtividade: string, nome: string) => {
    if (!editavel || !pav) return;
    setAlvo({
      chaves: [chaveCelula(pav.id, lado, idAtividade)],
      chaveOutroLado: chaveCelula(pav.id, lado === "A" ? "B" : "A", idAtividade),
      titulo: nome, subtitulo: `${pav.nome} — Lado ${lado}`, x: e.clientX - 250, y: e.clientY,
    });
  };
  const alternar = (id: string) => setAbertos(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg" aria-label="Escadinha">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <ListChecks className="h-5 w-5 text-blue-600" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-slate-800">{pav ? pav.nome : "Escadinha da torre"}</h2>
          <p className="text-[11px] text-slate-500">{pav ? "Atividades por lado" : `${Math.round(resumo.percentual * 100)}% executado · ${atrasadas} atrasada(s)`}</p>
        </div>
        {pav && <button type="button" onClick={onVerTudo} className="rounded-lg px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50">Ver torre</button>}
        <button type="button" onClick={onFechar} aria-label="Fechar painel" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </header>
      {pav && (onAbrirPlanta || onVer3D) && (
        <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
          {onAbrirPlanta && (
            <button type="button" onClick={() => onAbrirPlanta(pav.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
              <IconePlanta className="h-3.5 w-3.5" /> Abrir planta
            </button>
          )}
          {onVer3D && (
            <button type="button" onClick={() => onVer3D(pav.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Box className="h-3.5 w-3.5" /> Ver em 3D
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="flex-1 text-[11px] font-bold text-slate-500">
            Início da obra
            <input type="date" value={inicioObra ?? ""} disabled={!editavel} onChange={e => onInicioObra(e.target.value || null)}
              className="mt-0.5 block w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50" />
          </label>
          <div className="flex-1 text-[11px] font-bold text-slate-500">
            Período de referência
            <p className="mt-0.5 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-800">
              {periodo ? `${periodo.indice + 1}º · ${dataCurta(periodo.inicio)} a ${dataCurta(periodo.fim)}` : "Defina o início"}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <Filter className="h-3.5 w-3.5" /> No 3D:
          <select value={valorFiltro} onChange={e => mudarFiltro(e.target.value)} aria-label="Filtrar o 3D por atividade"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800">
            <option value="tudo">Tudo o que já foi feito</option>
            {modelo.ciclos.map(c => (
              <optgroup key={c.id} label={c.nome}>
                <option value={`ciclo:${c.id}`}>{c.nome} inteiro</option>
                {c.atividades.map(a => <option key={a.id} value={`atividade:${a.id}`}>{a.nome.slice(0, 60)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {pav ? (
          naGrade ? (
            <>
              <div role="tablist" aria-label="Lado" className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                {(["A", "B"] as Lado[]).map(l => (
                  <button key={l} type="button" role="tab" aria-selected={lado === l} onClick={() => setLado(l)}
                    className={`rounded-lg py-1.5 text-xs font-extrabold ${lado === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Lado {l}</button>
                ))}
              </div>
              <ul className="space-y-2">
                {modelo.ciclos.map(c => {
                  const avs = c.atividades.map(a => avaliacao.get(chaveCelula(pav.id, lado, a.id)));
                  const feitas = avs.filter(a => a?.status === "executado" || a?.status === "na").length;
                  const aberto = abertos.has(c.id) || (!abertos.size && feitas < c.atividades.length && avs.some(a => a && a.status !== "vazio"));
                  return (
                    <li key={c.id} className="overflow-hidden rounded-xl border border-slate-200">
                      <button type="button" onClick={() => alternar(c.id)} aria-expanded={aberto}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left" style={{ borderLeft: `6px solid ${c.cor}` }}>
                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-slate-800">{c.nome}</span>
                        <span className="text-[11px] font-bold text-slate-500">{feitas}/{c.atividades.length}</span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </button>
                      {aberto && (
                        <ul className="divide-y divide-slate-100 border-t border-slate-100">
                          {c.atividades.map((a, i) => {
                            const av = avs[i];
                            const cel = grade[chaveCelula(pav.id, lado, a.id)];
                            return (
                              <li key={a.id}>
                                <button type="button" disabled={!editavel} onClick={e => abrirMenu(e, a.id, a.nome)}
                                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-default"
                                  title={av ? ROTULO[av.status] : ""}>
                                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-slate-300" style={{ background: av ? COR_STATUS[av.status] : "#fff" }} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-semibold leading-snug text-slate-700">{a.nome}</span>
                                    <span className="text-[10px] text-slate-400">
                                      {av ? ROTULO[av.status] : ""}{cel?.s === "E" && cel.d ? ` em ${dataCurta(cel.d)}` : ""}
                                      {av?.janela ? ` · plano até ${dataCurta(av.janela[1])}` : ""}
                                    </span>
                                  </span>
                                  {a.install && <span className="rounded bg-blue-100 px-1 text-[9px] font-bold text-blue-700">Install</span>}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : <p className="text-sm text-slate-500">Este pavimento não entra na escadinha (subsolo ou barrilete).</p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-2"><p className="text-lg font-extrabold text-emerald-700">{Math.round(resumo.percentual * 100)}%</p><p className="text-[10px] font-bold text-emerald-700">executado</p></div>
              <div className="rounded-xl bg-red-50 p-2"><p className="text-lg font-extrabold text-red-600">{atrasadas}</p><p className="text-[10px] font-bold text-red-600">atrasadas</p></div>
              <div className="rounded-xl bg-pink-50 p-2"><p className="text-lg font-extrabold text-pink-600">{metas}</p><p className="text-[10px] font-bold text-pink-600">meta do período</p></div>
            </div>

            <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-400"><Lightbulb className="h-3.5 w-3.5" /> Pontos de atenção</h3>
            {pontos.length === 0 ? (
              <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{inicioObra ? "Nenhum gargalo: nada atrasado travando a escadinha." : "Defina o início da obra para o NordTool calcular atrasos e gargalos."}</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {pontos.map(g => (
                  <li key={g.chave}>
                    <button type="button" onClick={() => onFocar(g.linha.pavimento.id)}
                      className="flex w-full items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-left hover:bg-red-50">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="text-[11px] leading-snug text-slate-700">
                        Destravar <b>{g.atividade.nome.toLowerCase()}</b> no <b>{g.linha.pavimento.nome} · lado {g.linha.lado}</b>
                        <span className="block text-[10px] text-slate-500">{g.ciclo.nome} · segura {g.travaAtrasadas} atividade(s) atrasada(s)</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Avanço por ciclo</h3>
            <ul className="space-y-1.5">
              {resumo.avancoPorCiclo.map(({ ciclo, pavimentosConcluidos, ultimo }) => (
                <li key={ciclo.id} className="text-[11px]">
                  <div className="flex items-center justify-between font-bold text-slate-600">
                    <span className="truncate">{ciclo.nome}</span>
                    <span className="shrink-0 text-slate-400">{ultimo ? `até ${ultimo}` : "—"} · {pavimentosConcluidos}/{totalPavs}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(pavimentosConcluidos / Math.max(1, totalPavs)) * 100}%`, background: ciclo.cor }} />
                  </div>
                </li>
              ))}
            </ul>
            {projeto && <ResumoProjeto projeto={projeto.dados} resumo={projeto.resumo} />}
          </>
        )}
      </div>

      <footer className="flex gap-2 border-t border-slate-100 px-4 py-3">
        {editavel && (
          <button type="button" onClick={onAnexar} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Upload className="h-3.5 w-3.5" /> Projeto
          </button>
        )}
        {admin && (
          <button type="button" onClick={onModelo} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Settings2 className="h-3.5 w-3.5" /> Ciclos e atividades
          </button>
        )}
      </footer>
      {alvo && <MenuCelula alvo={alvo} hoje={hoje} onMarcar={onMarcar} onFechar={() => setAlvo(null)} />}
    </aside>
  );
}
