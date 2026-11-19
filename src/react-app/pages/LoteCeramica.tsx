import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Copy, Layers, Package, Pencil, Plus, RotateCcw, Search, Trash2, TrendingDown, Truck, X } from "lucide-react";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { BarrasHorizontais, MapaDeCalor, RoscaStatus } from "@/react-app/components/loteCeramica/Graficos";
import { loteCeramicaService as servico } from "@/react-app/services/LoteCeramicaService";
import {
  CORES, FILTROS_VAZIOS, LOTE_VAZIO, STATUS_LOTE, alertasDeMistura, contarPorStatus, filtrar, indicadores, mapaDeCalor, opcoes, saldo, saldoBaixo,
  saldoPorLote, somarPor, validar, type FiltrosLote, type LoteCeramica, type LoteCeramicaForm, type StatusLote,
} from "@/react-app/utils/loteCeramica";

const m2 = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
/** Nos cards, sem casas decimais para caber no projetor. */
const m2Card = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} m²`;
const data = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");

const ESTILO_STATUS: Record<StatusLote, string> = {
  "Em estoque": "bg-slate-100 text-slate-700",
  "Em aplicação": "bg-blue-50 text-[#1A35E6]",
  "Aplicado": "bg-teal-50 text-teal-700",
  "Reprovado": "bg-red-50 text-red-700",
};

function Painel({ titulo, children, tutorial, className = "" }: { titulo: string; children: ReactNode; tutorial?: string; className?: string }) {
  return (
    <section data-tutorial={tutorial} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} aria-label={titulo}>
      <h3 className="mb-4 text-sm font-black uppercase tracking-wider" style={{ color: CORES.marinho }}>{titulo}</h3>
      {children}
    </section>
  );
}

function Indicador({ icone: Icone, rotulo, valor, cor, destaque }: { icone: typeof Layers; rotulo: string; valor: string; cor: string; destaque?: boolean }) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm ${destaque ? "border-red-200 ring-2 ring-red-100" : "border-slate-200"}`}>
      <div className="shrink-0 rounded-xl p-3" style={{ background: `${cor}1A`, color: cor }}><Icone className="h-6 w-6" /></div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{rotulo}</p>
        <p className="whitespace-nowrap text-2xl font-black tabular-nums xl:text-[1.7rem]" style={{ color: destaque ? CORES.alerta : CORES.marinho }}>{valor}</p>
      </div>
    </div>
  );
}

/** Formulário de lançamento: novo, edição ou duplicação. */
function LoteModal({ titulo, inicial, onFechar, onSalvar }: {
  titulo: string; inicial: LoteCeramicaForm; onFechar: () => void; onSalvar: (f: LoteCeramicaForm) => Promise<void>;
}) {
  const [f, setF] = useState<LoteCeramicaForm>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const campo = <K extends keyof LoteCeramicaForm>(k: K, v: LoteCeramicaForm[K]) => setF(atual => ({ ...atual, [k]: v }));
  const texto = (k: keyof LoteCeramicaForm, rotulo: string, ph = "") => (
    <Campo rotulo={rotulo}>
      <input value={String(f[k] ?? "")} placeholder={ph} onChange={e => campo(k, e.target.value as never)} className={classeInput} />
    </Campo>
  );
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = validar(f);
    if (problema) return setErro(problema);
    await onSalvar(f);
  };
  const s = saldo(f);
  return (
    <ModalBase titulo={titulo} onFechar={onFechar} largura="max-w-3xl">
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {texto("torre", "Torre *", "Torre A")}
          {texto("pavimento", "Pavimento *", "3º pavimento")}
          {texto("ambiente", "Apartamento / ambiente", "Apto 31 · Sala")}
          {texto("fornecedor", "Fornecedor *")}
          {texto("produto", "Produto / referência")}
          {texto("lote", "Número do lote *", "LT-1001")}
          {texto("tonalidade", "Tonalidade", "T1")}
          {texto("calibre", "Calibre", "C1")}
          {texto("notaFiscal", "Nota fiscal")}
          <Campo rotulo="Data de fabricação"><input type="date" value={f.dataFabricacao} onChange={e => campo("dataFabricacao", e.target.value)} className={classeInput} /></Campo>
          <Campo rotulo="Data de recebimento"><input type="date" value={f.dataRecebimento} onChange={e => campo("dataRecebimento", e.target.value)} className={classeInput} /></Campo>
          <Campo rotulo="Status">
            <select value={f.status} onChange={e => campo("status", e.target.value as StatusLote)} className={classeInput}>
              {STATUS_LOTE.map(st => <option key={st}>{st}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Quantidade recebida (m²)">
            <input type="number" min={0} step="0.01" value={f.qtdRecebida} onChange={e => campo("qtdRecebida", Number(e.target.value))} className={classeInput} />
          </Campo>
          <Campo rotulo="Quantidade aplicada (m²)">
            <input type="number" min={0} step="0.01" value={f.qtdAplicada} onChange={e => campo("qtdAplicada", Number(e.target.value))} className={classeInput} />
          </Campo>
          <Campo rotulo="Saldo do lançamento">
            <p className={`rounded-xl px-3 py-2 text-sm font-bold ${saldoBaixo(f.qtdRecebida, f.qtdAplicada) ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-700"}`}>{m2(s)}</p>
          </Campo>
        </div>
        <Campo rotulo="Observações">
          <textarea rows={2} value={f.observacoes} onChange={e => campo("observacoes", e.target.value)} className={classeInput} />
        </Campo>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="submit" className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: CORES.azul }}>Salvar lote</button>
        </div>
      </form>
    </ModalBase>
  );
}

/** Mapeamentos → Controle de Lote de Cerâmica: rastreabilidade do lote, mistura de tonalidade e saldo. */
export default function LoteCeramicaPage() {
  const [lista, setLista] = useState<LoteCeramica[]>([]);
  const [filtros, setFiltros] = useState<FiltrosLote>(FILTROS_VAZIOS);
  const [edicao, setEdicao] = useState<{ titulo: string; id: string | null; inicial: LoteCeramicaForm } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => setLista(await servico.listar()), []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 3500); return () => clearTimeout(t); }, [aviso]);

  const visiveis = useMemo(() => filtrar(lista, filtros), [lista, filtros]);
  const ind = useMemo(() => indicadores(visiveis), [visiveis]);
  const alertas = useMemo(() => alertasDeMistura(visiveis), [visiveis]);
  const idsEmAlerta = useMemo(() => new Set(alertas.flatMap(a => a.ids)), [alertas]);
  const mapa = useMemo(() => mapaDeCalor(visiveis), [visiveis]);
  const saldos = useMemo(() => saldoPorLote(visiveis), [visiveis]);
  const porTorre = useMemo(() => somarPor(visiveis, l => l.torre, l => l.qtdAplicada), [visiveis]);
  const porFornecedor = useMemo(() => somarPor(visiveis, l => l.fornecedor, l => l.qtdAplicada), [visiveis]);
  const porStatus = useMemo(() => contarPorStatus(visiveis), [visiveis]);
  const filtrando = Object.values(filtros).some(Boolean);

  const salvar = async (f: LoteCeramicaForm) => {
    if (edicao?.id) await servico.salvar(edicao.id, f); else await servico.criar(f);
    setAviso(edicao?.id ? "Lote atualizado." : "Lote lançado.");
    setEdicao(null);
    await carregar();
  };
  const excluir = async (l: LoteCeramica) => {
    if (!window.confirm(`Excluir o lançamento do lote ${l.lote} (${l.torre} · ${l.pavimento})? Essa ação não pode ser desfeita.`)) return;
    await servico.excluir(l.id);
    setAviso("Lançamento excluído.");
    await carregar();
  };
  const restaurar = async () => {
    if (!window.confirm("Voltar para os registros de exemplo? Os lançamentos atuais desta tela serão substituídos.")) return;
    setLista(await servico.restaurarExemplos());
    setFiltros(FILTROS_VAZIOS);
  };
  const filtro = (k: keyof FiltrosLote, rotulo: string, valores: string[]) => (
    <select aria-label={`Filtrar por ${rotulo}`} value={filtros[k]} onChange={e => setFiltros({ ...filtros, [k]: e.target.value })} className={`${classeInput} sm:w-auto`}>
      <option value="">{rotulo}: todos</option>
      {valores.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <div className="space-y-6 p-3 sm:p-6">
      <CabecalhoPagina icone={Layers} titulo="Controle de Lote de Cerâmica" subtitulo="Rastreabilidade dos lotes aplicados em cada torre, tonalidade e saldo"
        acoes={<>
          <button type="button" onClick={() => void restaurar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" />Restaurar exemplos
          </button>
          <button type="button" data-tutorial="lote-novo" onClick={() => setEdicao({ titulo: "Novo lote", id: null, inicial: LOTE_VAZIO })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90" style={{ background: CORES.azul }}>
            <Plus className="h-4 w-4" />Novo lote
          </button>
        </>} />

      {aviso && <p role="status" className="rounded-xl bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800">{aviso}</p>}

      <div data-tutorial="lote-indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador icone={Layers} rotulo="Total de lotes" valor={String(ind.totalLotes)} cor={CORES.marinho} />
        <Indicador icone={Truck} rotulo="m² recebidos" valor={m2Card(ind.recebido)} cor={CORES.azul} />
        <Indicador icone={Package} rotulo="m² aplicados" valor={m2Card(ind.aplicado)} cor={CORES.agua} />
        <Indicador icone={TrendingDown} rotulo="Saldo em estoque" valor={m2Card(ind.saldo)} cor={CORES.marinho} />
        <Indicador icone={AlertTriangle} rotulo="Alertas de mistura" valor={String(ind.alertas)} cor={CORES.alerta} destaque={ind.alertas > 0} />
      </div>

      <div data-tutorial="lote-graficos" className="grid gap-4 lg:grid-cols-3">
        <Painel titulo="m² aplicados por torre"><BarrasHorizontais dados={porTorre} cor={CORES.azul} unidade="m²" /></Painel>
        <Painel titulo="Distribuição por status"><RoscaStatus dados={porStatus} /></Painel>
        <Painel titulo="Consumo por fornecedor"><BarrasHorizontais dados={porFornecedor} cor={CORES.agua} unidade="m²" /></Painel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Painel titulo="Mapa de mistura · torre × pavimento" tutorial="lote-mapa" className="xl:col-span-3">
          <MapaDeCalor {...mapa} />
        </Painel>
        <Painel titulo={`Alertas de mistura (${alertas.length})`} tutorial="lote-alertas" className="xl:col-span-2">
          {alertas.length === 0 ? (
            <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">Nenhuma mistura de lote, tonalidade ou calibre nos locais aplicados.</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map(a => (
                <li key={a.local} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-black text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{a.local}</p>
                  <p className="mt-1 text-xs text-red-700">
                    {a.motivos.includes("lote") && <>Lotes {a.lotes.join(" + ")}. </>}
                    {a.motivos.includes("tonalidade") && <>Tonalidades {a.tonalidades.join(" + ")}. </>}
                    {a.motivos.includes("calibre") && <>Calibres {a.calibres.join(" + ")}. </>}
                    Risco de diferença de tom: conferir antes de seguir.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <Painel titulo="Saldo por lote" tutorial="lote-saldo">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {saldos.map(s => {
            const pct = s.recebido > 0 ? Math.min(100, (s.aplicado / s.recebido) * 100) : 0;
            return (
              <div key={`${s.fornecedor}-${s.lote}`} className={`rounded-xl border p-3 ${s.baixo ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-black" style={{ color: CORES.marinho }}>{s.lote}</p>
                  {s.baixo && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">Saldo baixo</span>}
                </div>
                <p className="truncate text-xs text-slate-500" title={`${s.fornecedor} · ${s.produto}`}>{s.fornecedor}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.baixo ? CORES.aviso : CORES.agua }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-600"><strong className="text-slate-800">{m2(s.saldo)}</strong> de {m2(s.recebido)} · {Math.round(pct)}% aplicado</p>
              </div>
            );
          })}
        </div>
      </Painel>

      <section data-tutorial="lote-tabela" className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Lançamentos de lotes">
        <div data-tutorial="lote-filtros" className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar lote, fornecedor, NF, apartamento…"
              aria-label="Buscar lançamentos" className={`${classeInput} pl-9`} />
          </div>
          {filtro("torre", "Torre", opcoes(lista, "torre"))}
          {filtro("pavimento", "Pavimento", opcoes(lista, "pavimento"))}
          {filtro("fornecedor", "Fornecedor", opcoes(lista, "fornecedor"))}
          {filtro("lote", "Lote", opcoes(lista, "lote"))}
          {filtro("status", "Status", [...STATUS_LOTE])}
          {filtrando && (
            <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />Limpar
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-white" style={{ background: CORES.marinho }}>
                {["Torre / pavimento", "Apto / ambiente", "Fornecedor / produto", "Lote", "Tom", "Cal.", "Recebido", "Aplicado", "Saldo", "Recebimento", "NF", "Status", ""].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiveis.map(l => {
                const s = saldo(l);
                const baixo = l.status !== "Reprovado" && saldoBaixo(l.qtdRecebida, l.qtdAplicada);
                const misturado = idsEmAlerta.has(l.id);
                return (
                  <tr key={l.id} className={misturado ? "bg-red-50/60" : "hover:bg-slate-50"}>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <p className="font-bold text-slate-800">{l.torre}</p>
                      <p className="text-xs text-slate-500">{l.pavimento}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{l.ambiente || "—"}</td>
                    <td className="max-w-[16rem] px-3 py-2.5">
                      <p className="truncate font-semibold text-slate-700" title={l.fornecedor}>{l.fornecedor}</p>
                      <p className="truncate text-xs text-slate-500" title={l.produto}>{l.produto}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-black" style={{ color: CORES.marinho }}>
                      {misturado && <AlertTriangle className="mr-1 inline h-4 w-4 text-red-600" aria-label="Mistura neste local" />}{l.lote}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{l.tonalidade || "—"}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{l.calibre || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">{m2(l.qtdRecebida)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">{m2(l.qtdAplicada)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`rounded-lg px-2 py-1 text-xs font-black tabular-nums ${baixo ? "bg-amber-100 text-amber-800" : "text-slate-800"}`}>{m2(s)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{data(l.dataRecebimento)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{l.notaFiscal || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTILO_STATUS[l.status]}`}>{l.status}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button type="button" aria-label={`Editar lote ${l.lote} de ${l.torre} ${l.pavimento}`} title="Editar"
                        onClick={() => { const { id, ...resto } = l; setEdicao({ titulo: `Editar lote ${l.lote}`, id, inicial: resto }); }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1A35E6]"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Duplicar lote ${l.lote} de ${l.torre} ${l.pavimento}`} title="Duplicar"
                        onClick={() => { const { id: _id, ...resto } = l; void _id; setEdicao({ titulo: `Duplicar lote ${l.lote}`, id: null, inicial: { ...resto, ambiente: "", qtdAplicada: 0 } }); }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600"><Copy className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Excluir lote ${l.lote} de ${l.torre} ${l.pavimento}`} title="Excluir" onClick={() => void excluir(l)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-sm text-slate-500">Nenhum lançamento com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">{visiveis.length} de {lista.length} lançamentos · dados guardados neste navegador</p>
      </section>

      {edicao && <LoteModal titulo={edicao.titulo} inicial={edicao.inicial} onFechar={() => setEdicao(null)} onSalvar={salvar} />}
    </div>
  );
}
