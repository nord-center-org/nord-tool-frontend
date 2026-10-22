import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardPaste, FileSpreadsheet, Loader2, Lock, Minus, Plus, RotateCcw, Save, Trash2,
} from "lucide-react";

import { ApiError } from "@/react-app/services/apiClient";
import { mapeamentoService as servico, type Mapeamento } from "@/react-app/services/MapeamentoService";
import {
  ROTULO_ALERTA, ROTULO_TIPO, comparar, formatarNumero, lerColagem, lerNumero, linhasPlanilha, totaisPorGrupo, type LinhaMapeamento,
} from "@/react-app/utils/mapeamentos";

const campo = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Linha na tela: números como texto para aceitar "12," enquanto a pessoa digita. */
interface LinhaEdicao { chave: number; grupo: string; item: string; unidade: string; projeto: string; medida: string; solicitada: string; obs: string }

const paraTexto = (n: number | null) => (n == null ? "" : formatarNumero(n).replace(/\./g, ""));
const paraEdicao = (l: LinhaMapeamento, chave: number): LinhaEdicao => ({
  chave, grupo: l.nmGrupo ?? "", item: l.nmItem, unidade: l.nmUnidade, projeto: paraTexto(l.qtProjeto), medida: paraTexto(l.qtMedida),
  solicitada: paraTexto(l.qtSolicitada), obs: l.txObservacao ?? "",
});
const paraLinha = (l: LinhaEdicao): LinhaMapeamento => ({
  nmGrupo: l.grupo.trim() || null, nmItem: l.item.trim(), nmUnidade: l.unidade.trim() || "un",
  qtProjeto: lerNumero(l.projeto), qtMedida: lerNumero(l.medida), qtSolicitada: lerNumero(l.solicitada), txObservacao: l.obs.trim() || null,
});

interface Props { id: number; podeEditar: boolean; onVoltar: () => void; onAlterado: (m: Mapeamento) => void; onExcluido: (id: number) => void }

export default function EditorMapeamento({ id, podeEditar, onVoltar, onAlterado, onExcluido }: Props) {
  const [m, setM] = useState<Mapeamento | null>(null);
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [tolerancia, setTolerancia] = useState("5");
  const [obs, setObs] = useState("");
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([]);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const chaves = useRef(0);

  const aplicar = useCallback((x: Mapeamento) => {
    setM(x);
    setTitulo(x.nmTitulo);
    setLocal(x.nmLocal ?? "");
    setData(x.dtMapeamento);
    setTolerancia(formatarNumero(x.pcTolerancia, 2));
    setObs(x.txObservacao ?? "");
    setLinhas((x.linhas ?? []).map(l => paraEdicao(l, ++chaves.current)));
    setSujo(false);
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try { aplicar(await servico.detalhar(id)); } catch (e) { setErro(mensagem(e, "Não foi possível abrir o mapeamento.")); }
  }, [aplicar, id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const pcTolerancia = lerNumero(tolerancia) ?? 0;
  const convertidas = useMemo(() => linhas.map(paraLinha), [linhas]);
  const totais = useMemo(() => totaisPorGrupo(convertidas), [convertidas]);
  const comAlerta = useMemo(() => convertidas.filter(l => comparar(l, pcTolerancia).alertas.length > 0).length, [convertidas, pcTolerancia]);

  if (!m) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-sm">
        {erro ? <><p role="alert" className="text-red-700">{erro}</p><button type="button" onClick={onVoltar} className="font-semibold text-blue-600">Voltar</button></>
          : <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />}
      </div>
    );
  }

  const quantitativo = m.cdTipo === "QUANTITATIVO";
  const concluido = m.cdStatus === "CONCLUIDO";
  const editavel = podeEditar && !concluido;
  const mexer = (f: () => void) => { f(); setSujo(true); setAviso(null); };
  const alterar = (chave: number, mud: Partial<LinhaEdicao>) => mexer(() => setLinhas(l => l.map(x => (x.chave === chave ? { ...x, ...mud } : x))));
  const somar = (l: LinhaEdicao, delta: number) => {
    const atual = lerNumero(l.medida);
    const base = atual == null || Number.isNaN(atual) ? 0 : atual;
    alterar(l.chave, { medida: paraTexto(Math.max(0, base + delta)) });
  };
  const novaLinha = (): LinhaEdicao => {
    const anterior = linhas[linhas.length - 1];
    return { chave: ++chaves.current, grupo: anterior?.grupo ?? "", item: "", unidade: anterior?.unidade ?? (quantitativo ? "m²" : "un"), projeto: "", medida: "", solicitada: "", obs: "" };
  };

  const tratar409 = async (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) {
      setAviso("Outra pessoa alterou este mapeamento. Recarreguei a versão atual; refaça sua alteração.");
      await carregar();
      return true;
    }
    return false;
  };

  const validar = (): string | null => {
    if (!titulo.trim()) return "Informe o título.";
    if (Number.isNaN(pcTolerancia) || pcTolerancia < 0 || pcTolerancia > 100) return "A tolerância vai de 0 a 100%.";
    const ruim = convertidas.findIndex(l => !l.nmItem || [l.qtProjeto, l.qtMedida, l.qtSolicitada].some(v => v != null && Number.isNaN(v)));
    if (ruim >= 0) return `Linha ${ruim + 1}: informe o item e use números válidos (ex.: 12,5).`;
    return null;
  };

  const salvar = async (): Promise<boolean> => {
    const problema = validar();
    if (problema) { setErro(problema); return false; }
    setOcupado("salvar");
    setErro(null);
    try {
      const r = await servico.alterar(id, {
        nmTitulo: titulo.trim(), nmLocal: local.trim() || null, dtMapeamento: data, pcTolerancia, txObservacao: obs.trim() || null,
        nrVersao: m.nrVersao, linhas: convertidas,
      });
      aplicar(r);
      onAlterado(r);
      setAviso("Mapeamento salvo.");
      return true;
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível salvar."));
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const trocarStatus = async () => {
    if (sujo && !(await salvar())) return;
    setOcupado("status");
    try {
      const atual = await servico.detalhar(id);
      const r = await servico.alterarStatus(id, concluido ? "RASCUNHO" : "CONCLUIDO", atual.nrVersao);
      aplicar(r);
      onAlterado(r);
      setAviso(concluido ? "Mapeamento reaberto." : "Mapeamento concluído.");
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível alterar o status."));
    } finally {
      setOcupado(null);
    }
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir o mapeamento "${m.nmTitulo}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await servico.excluir(id, m.nrVersao);
      onExcluido(id);
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível excluir."));
    }
  };

  const colar = () => {
    const r = lerColagem(textoColado);
    if (r.linhas.length) mexer(() => setLinhas(l => [...l, ...r.linhas.map(x => paraEdicao(x, ++chaves.current))]));
    setErro(r.erros.length ? `${r.linhas.length} linha(s) adicionada(s). ${r.erros.join(" ")}` : null);
    if (!r.erros.length) { setColando(false); setTextoColado(""); setAviso(`${r.linhas.length} linha(s) adicionada(s). Salve para gravar.`); }
  };

  const exportar = () => {
    const planilha = XLSX.utils.json_to_sheet(linhasPlanilha(m.cdTipo, convertidas, pcTolerancia));
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, quantitativo ? "Quantitativo" : "Contagem");
    const totaisPlanilha = XLSX.utils.json_to_sheet(totais.map(t => ({
      Grupo: t.grupo, Unidade: t.unidade, Linhas: t.linhas, ...(quantitativo ? { Projeto: t.projeto, Medido: t.medida, Solicitado: t.solicitada } : { Contado: t.medida }),
    })));
    XLSX.utils.book_append_sheet(livro, totaisPlanilha, "Totais");
    const nome = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mapeamento";
    XLSX.writeFile(livro, `Mapeamento-${nome}-${data}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { if (!sujo || window.confirm("Sair sem salvar as alterações?")) onVoltar(); }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Mapeamentos</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportar} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Planilha
          </button>
          {podeEditar && (
            <button type="button" onClick={() => void trocarStatus()} disabled={ocupado !== null}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60 ${concluido ? "border border-slate-200 bg-white text-slate-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
              {concluido ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {concluido ? "Reabrir" : "Concluir"}
            </button>
          )}
          {editavel && (
            <button type="button" onClick={() => void salvar()} disabled={!sujo || ocupado !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {ocupado === "salvar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </button>
          )}
        </div>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}
      {concluido && <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600"><Lock className="h-4 w-4" /> Concluído: reabra para editar.</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Dados do mapeamento">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{ROTULO_TIPO[m.cdTipo]}</span>
          {m.nmFase && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{m.nmFase}</span>}
          {quantitativo && (
            <span className={`rounded-full px-2.5 py-1 ${comAlerta ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {comAlerta ? `${comAlerta} linha(s) com alerta` : "Sem alertas"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Título</span>
            <input value={titulo} disabled={!editavel} maxLength={150} onChange={e => mexer(() => setTitulo(e.target.value))} className={`mt-1 ${campo} py-2`} /></label>
          <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Local</span>
            <input value={local} disabled={!editavel} maxLength={150} onChange={e => mexer(() => setLocal(e.target.value))} className={`mt-1 ${campo} py-2`} /></label>
          <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</span>
            <input type="date" value={data} disabled={!editavel} onChange={e => mexer(() => setData(e.target.value))} className={`mt-1 ${campo} py-2`} /></label>
          {quantitativo && (
            <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tolerância (%)</span>
              <input inputMode="decimal" value={tolerancia} disabled={!editavel} onChange={e => mexer(() => setTolerancia(e.target.value))} className={`mt-1 ${campo} py-2`} /></label>
          )}
          <label className={`block ${quantitativo ? "sm:col-span-3" : "sm:col-span-4"}`}><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observação</span>
            <input value={obs} disabled={!editavel} maxLength={2000} onChange={e => mexer(() => setObs(e.target.value))} className={`mt-1 ${campo} py-2`} /></label>
        </div>
      </section>

      <section aria-label="Linhas">
        <ol className="space-y-2">
          {linhas.map((l, i) => {
            const c = quantitativo ? comparar(convertidas[i], pcTolerancia) : null;
            return (
              <li key={l.chave} className={`rounded-2xl border bg-white p-3 shadow-sm ${c?.alertas.length ? "border-amber-300" : "border-slate-200"}`}>
                <div className={`grid grid-cols-2 gap-2 ${quantitativo ? "sm:grid-cols-[1fr_2fr_4rem_repeat(3,6rem)_auto]" : "sm:grid-cols-[1fr_2fr_4rem_9rem_auto]"} sm:items-end`}>
                  <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">{quantitativo ? "Disciplina" : "Grupo"}</span>
                    <input aria-label={`Grupo da linha ${i + 1}`} value={l.grupo} disabled={!editavel} maxLength={80} onChange={e => alterar(l.chave, { grupo: e.target.value })} className={campo} /></label>
                  <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">Item</span>
                    <input aria-label={`Item da linha ${i + 1}`} value={l.item} disabled={!editavel} maxLength={150} onChange={e => alterar(l.chave, { item: e.target.value })} className={campo} /></label>
                  <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">Un.</span>
                    <input aria-label={`Unidade da linha ${i + 1}`} value={l.unidade} disabled={!editavel} maxLength={10} onChange={e => alterar(l.chave, { unidade: e.target.value })} className={campo} /></label>
                  {quantitativo ? (
                    <>
                      <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">Projeto</span>
                        <input aria-label={`Projeto da linha ${i + 1}`} inputMode="decimal" value={l.projeto} disabled={!editavel} onChange={e => alterar(l.chave, { projeto: e.target.value })} className={`${campo} text-right`} /></label>
                      <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">Medido</span>
                        <input aria-label={`Medido da linha ${i + 1}`} inputMode="decimal" value={l.medida} disabled={!editavel} onChange={e => alterar(l.chave, { medida: e.target.value })} className={`${campo} text-right`} /></label>
                      <label className="block"><span className="text-[10px] font-bold uppercase text-slate-400">Solicitado</span>
                        <input aria-label={`Solicitado da linha ${i + 1}`} inputMode="decimal" value={l.solicitada} disabled={!editavel} onChange={e => alterar(l.chave, { solicitada: e.target.value })} className={`${campo} text-right`} /></label>
                    </>
                  ) : (
                    <div className="col-span-2 sm:col-span-1"><span className="text-[10px] font-bold uppercase text-slate-400">Contado</span>
                      <div className="flex items-center gap-1">
                        {editavel && <button type="button" aria-label={`Diminuir linha ${i + 1}`} onClick={() => somar(l, -1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:scale-95"><Minus className="h-4 w-4" /></button>}
                        <input aria-label={`Contado da linha ${i + 1}`} inputMode="decimal" value={l.medida} disabled={!editavel} onChange={e => alterar(l.chave, { medida: e.target.value })} className={`${campo} text-center text-base font-bold`} />
                        {editavel && <button type="button" aria-label={`Somar linha ${i + 1}`} onClick={() => somar(l, 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white active:scale-95"><Plus className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  )}
                  {editavel && (
                    <button type="button" aria-label={`Remover linha ${i + 1}`} onClick={() => mexer(() => setLinhas(x => x.filter(y => y.chave !== l.chave)))}
                      className="justify-self-end rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                {c && (c.difMedido != null || c.difSolicitado != null || c.alertas.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {c.difMedido != null && <span>Medido − projeto: <b className={c.difMedido > 0 ? "text-amber-700" : "text-slate-700"}>{formatarNumero(c.difMedido)}</b>{c.pctMedido != null && ` (${formatarNumero(c.pctMedido, 1)}%)`}</span>}
                    {c.difSolicitado != null && <span>Solicitado − medido: <b className={c.difSolicitado > 0 ? "text-amber-700" : "text-slate-700"}>{formatarNumero(c.difSolicitado)}</b></span>}
                    {c.alertas.map(a => <span key={a} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> {ROTULO_ALERTA[a]}</span>)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {linhas.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhuma linha ainda.</p>}
        {editavel && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => mexer(() => setLinhas(l => [...l, novaLinha()]))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-white">
              <Plus className="h-4 w-4" /> Adicionar linha
            </button>
            <button type="button" onClick={() => setColando(v => !v)} aria-expanded={colando} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-white">
              <ClipboardPaste className="h-4 w-4" /> Colar do Excel
            </button>
          </div>
        )}
        {colando && editavel && (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs text-slate-500">Copie da planilha as colunas <b>Grupo, Item, Unidade, Projeto, Medido, Solicitado</b> (nessa ordem) e cole aqui.</p>
            <textarea aria-label="Linhas coladas" rows={5} value={textoColado} onChange={e => setTextoColado(e.target.value)} className={`${campo} font-mono text-xs`} />
            <div className="mt-2 flex justify-end"><button type="button" onClick={colar} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Adicionar linhas</button></div>
          </div>
        )}
      </section>

      {totais.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Totais por grupo">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Totais por grupo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-slate-400">
                <th className="py-1 pr-3">Grupo</th><th className="py-1 pr-3">Un.</th><th className="py-1 pr-3 text-right">Linhas</th>
                {quantitativo ? <><th className="py-1 pr-3 text-right">Projeto</th><th className="py-1 pr-3 text-right">Medido</th><th className="py-1 text-right">Solicitado</th></> : <th className="py-1 text-right">Contado</th>}
              </tr></thead>
              <tbody>
                {totais.map(t => (
                  <tr key={`${t.grupo}-${t.unidade}`} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{t.grupo}</td><td className="py-1.5 pr-3 text-slate-500">{t.unidade}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-500">{t.linhas}</td>
                    {quantitativo ? <><td className="py-1.5 pr-3 text-right">{formatarNumero(t.projeto)}</td><td className="py-1.5 pr-3 text-right">{formatarNumero(t.medida)}</td><td className="py-1.5 text-right">{formatarNumero(t.solicitada)}</td></>
                      : <td className="py-1.5 text-right font-bold">{formatarNumero(t.medida)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {podeEditar && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void excluir()} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Excluir mapeamento</button>
        </div>
      )}
    </div>
  );
}
