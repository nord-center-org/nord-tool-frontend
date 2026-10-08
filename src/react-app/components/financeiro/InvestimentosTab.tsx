import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Download, Loader2, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { FinanceiroAtivo, FinanceiroInvestimentos, FinanceiroPessoa } from "@/shared/types";
import { AtivoModal, OperacaoModal, ProventoModal } from "@/react-app/components/financeiro/InvestimentoModais";
import { financeiroService, type OperacaoForm, type ProventoForm } from "@/react-app/services/FinanceiroService";
import { formatarMoeda } from "@/react-app/utils/casamento";
import { INTERVALO_COTACAO_MS, proximosProventos, sinalResultado, textoCotacao, textoPercentual } from "@/react-app/utils/investimentos";

interface InvestimentosTabProps {
  pessoas: FinanceiroPessoa[];
  idPessoa: number;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

function Resultado({ valor, pc }: { valor: number; pc: number }) {
  const sinal = sinalResultado(valor);
  const Icone = sinal === "alta" ? ArrowUpRight : sinal === "baixa" ? ArrowDownRight : Minus;
  const cor = sinal === "alta" ? "text-green-700" : sinal === "baixa" ? "text-red-600" : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${cor}`}>
      <Icone className="h-3.5 w-3.5" aria-hidden /> {formatarMoeda(valor)} <span className="text-xs font-medium">({textoPercentual(pc)})</span>
    </span>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

/** Fundos imobiliários: posição, cotação ao vivo (atualiza a cada minuto) e proventos a receber. */
export default function InvestimentosTab({ pessoas, idPessoa }: InvestimentosTabProps) {
  const [dados, setDados] = useState<FinanceiroInvestimentos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [abertos, setAbertos] = useState<number[]>([]);
  const [modal, setModal] = useState<
    { tipo: "ativo" } | { tipo: "operacao" | "provento"; idAtivo: number } | null
  >(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      setDados(await financeiroService.investimentos(idPessoa || undefined) ?? null);
      setAtualizadoEm(new Date());
      setErro(null);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar os investimentos."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [idPessoa]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Cotação "ao vivo": relê a cada minuto enquanto a aba está visível (o servidor guarda cache de 60 s).
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void carregar(true); }, INTERVALO_COTACAO_MS);
    return () => window.clearInterval(id);
  }, [carregar]);

  const ativos = useMemo(() => dados?.ativos ?? [], [dados]);
  const proximos = useMemo(() => proximosProventos(ativos), [ativos]);
  const ativoModal = modal && modal.tipo !== "ativo" ? ativos.find(a => a.idAtivo === modal.idAtivo) : undefined;

  /** Aplica a mudança no servidor e relê tudo (os totais mudam). Devolve a mensagem de erro, se houver. */
  const executar = async (acao: () => Promise<unknown>, falha: string): Promise<string | null> => {
    try {
      await acao();
      setModal(null);
      await carregar(true);
      return null;
    } catch (e) {
      return mensagem(e, falha);
    }
  };

  const agir = async (acao: () => Promise<unknown>, falha: string, sucesso?: string) => {
    setAviso(null);
    const erroAcao = await executar(acao, falha);
    if (erroAcao) setErro(erroAcao); else if (sucesso) setAviso(sucesso);
  };

  const alternar = (id: number) => setAbertos(lista => (lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]));

  const importar = (a: FinanceiroAtivo) => void agir(async () => {
    const r = await financeiroService.sincronizarProventos(a.idAtivo);
    setAviso(r?.importados ? `${r.importados} provento(s) importado(s) de ${a.cdTicker}.` : `Nenhum provento novo de ${a.cdTicker}. Se faltar algum, informe manualmente.`);
  }, "Não foi possível importar os proventos.");

  const excluirOperacao = (id: number, texto: string) => {
    if (window.confirm(`Excluir ${texto}?`)) void agir(() => financeiroService.excluirOperacao(id), "Não foi possível excluir a operação.");
  };
  const excluirProvento = (id: number, texto: string) => {
    if (window.confirm(`Excluir ${texto}?`)) void agir(() => financeiroService.excluirProvento(id), "Não foi possível excluir o provento.");
  };
  const arquivar = (a: FinanceiroAtivo) => {
    if (window.confirm(`Tirar ${a.cdTicker} (${a.nmPessoa}) da carteira? O histórico fica guardado e dá para adicionar de novo.`)) {
      void agir(() => financeiroService.arquivarAtivo(a.idAtivo, a.nrVersao), "Não foi possível arquivar o fundo.");
    }
  };

  const hora = atualizadoEm?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-slate-500" role="status">
          {atualizando && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Atualizando" />}
          {dados && (dados.cotacaoAoVivo ? `Cotações ao vivo · conferido às ${hora}` : `Sem cotação ao vivo agora · conferido às ${hora}`)}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void carregar(true)} disabled={atualizando} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button type="button" onClick={() => setModal({ tipo: "ativo" })} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Novo fundo
          </button>
        </div>
      </div>

      {aviso && <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{aviso}</p>}
      {erro && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{erro}</span>
          <button type="button" onClick={() => { setErro(null); void carregar(); }} className="font-bold underline">Tentar novamente</button>
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : dados && ativos.length === 0 ? (
        <section className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-bold text-slate-700">Nenhum fundo na carteira</h2>
          <p className="mt-1 text-sm text-slate-500">Adicione um fundo imobiliário e registre suas compras para acompanhar a cotação e os dividendos.</p>
          <button type="button" onClick={() => setModal({ tipo: "ativo" })} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Novo fundo</button>
        </section>
      ) : dados ? (
        <div className={`space-y-4 transition-opacity ${atualizando ? "opacity-70" : ""}`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Resumo rotulo="Patrimônio" valor={formatarMoeda(dados.vlPatrimonio)} detalhe={`Investido: ${formatarMoeda(dados.vlInvestido)}`} />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Resultado</p>
              <p className="mt-1 text-xl"><Resultado valor={dados.vlResultado} pc={dados.pcResultado} /></p>
            </div>
            <Resumo rotulo="A receber no mês" valor={formatarMoeda(dados.vlAReceberMes)} detalhe="Proventos com pagamento neste mês" />
            <Resumo rotulo="A receber (total)" valor={formatarMoeda(dados.vlAReceber)} detalhe={proximos[0] ? `Próximo: ${proximos[0].ativo.cdTicker} em ${proximos[0].provento.dtPagamento}` : "Nenhum provento a pagar"} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-2"><span className="sr-only">Detalhes</span></th>
                  <th className="px-3 py-2">Fundo</th>
                  <th className="px-3 py-2 text-right">Cotas</th>
                  <th className="px-3 py-2 text-right">Preço médio</th>
                  <th className="px-3 py-2 text-right">Cotação</th>
                  <th className="px-3 py-2 text-right">Patrimônio</th>
                  <th className="px-3 py-2 text-right">Resultado</th>
                  <th className="px-3 py-2 text-right">A receber</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map(a => {
                  const aberto = abertos.includes(a.idAtivo);
                  return (
                    <Fragment key={a.idAtivo}>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <button type="button" aria-expanded={aberto} aria-label={`${aberto ? "Recolher" : "Ver"} histórico de ${a.cdTicker}`} onClick={() => alternar(a.idAtivo)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-bold text-slate-900">{a.cdTicker}</p>
                          <p className="text-xs text-slate-500">{a.nmPessoa}{a.nmAtivo ? ` · ${a.nmAtivo}` : ""}</p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.qtCotas}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(a.vlPrecoMedio)}</td>
                        <td className="px-3 py-2 text-right tabular-nums" title={textoCotacao(a.dhCotacao, a.cotacaoAoVivo)}>
                          {a.vlCotacao !== null ? formatarMoeda(a.vlCotacao) : "—"}
                          {a.vlCotacao !== null && !a.cotacaoAoVivo && <span className="ml-1 text-[10px] font-bold uppercase text-amber-600">antiga</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatarMoeda(a.vlPatrimonio)}</td>
                        <td className="px-3 py-2 text-right"><Resultado valor={a.vlResultado} pc={a.pcResultado} /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(a.vlAReceber)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setModal({ tipo: "operacao", idAtivo: a.idAtivo })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">Compra/venda</button>
                            <button type="button" onClick={() => setModal({ tipo: "provento", idAtivo: a.idAtivo })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">Provento</button>
                          </div>
                        </td>
                      </tr>
                      {aberto && (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td />
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Compras e vendas</h4>
                                {a.operacoes.length === 0 ? <p className="text-sm text-slate-500">Nenhuma operação ainda.</p> : (
                                  <ul className="divide-y divide-slate-200 text-sm">
                                    {a.operacoes.map(o => (
                                      <li key={o.idOperacao} className="flex items-center justify-between gap-2 py-1.5">
                                        <span><strong>{o.cdTipo === "COMPRA" ? "Compra" : "Venda"}</strong> · {o.dtOperacao} · {o.qtCotas} × {formatarMoeda(o.vlPreco)}</span>
                                        <button type="button" aria-label={`Excluir ${o.cdTipo === "COMPRA" ? "compra" : "venda"} de ${o.dtOperacao}`} onClick={() => excluirOperacao(o.idOperacao, `${o.cdTipo === "COMPRA" ? "a compra" : "a venda"} de ${o.qtCotas} cota(s) de ${a.cdTicker} em ${o.dtOperacao}`)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Proventos</h4>
                                  <button type="button" onClick={() => importar(a)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><Download className="h-3 w-3" /> Importar</button>
                                </div>
                                {a.proventos.length === 0 ? <p className="text-sm text-slate-500">Nenhum provento registrado.</p> : (
                                  <ul className="divide-y divide-slate-200 text-sm">
                                    {a.proventos.map(p => (
                                      <li key={p.idProvento} className="flex items-center justify-between gap-2 py-1.5">
                                        <span>
                                          <strong>{formatarMoeda(p.vlTotal)}</strong> · {p.qtCotas} × {p.vlPorCota.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                          <span className="ml-2 text-xs text-slate-500">paga em {p.dtPagamento} · {p.recebido ? "recebido" : "a receber"}{p.cdOrigem === "COTACAO" ? " · importado" : ""}</span>
                                        </span>
                                        <button type="button" aria-label={`Excluir provento de ${p.dtPagamento}`} onClick={() => excluirProvento(p.idProvento, `o provento de ${a.cdTicker} pago em ${p.dtPagamento}`)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                              <span>{textoCotacao(a.dhCotacao, a.cotacaoAoVivo)}</span>
                              <button type="button" onClick={() => arquivar(a)} className="font-bold text-slate-500 hover:text-red-600 hover:underline">Tirar da carteira</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {proximos.length > 0 && (
            <section aria-label="Próximos proventos" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-800">Dividendos a receber</h3>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {proximos.map(({ ativo, provento }) => (
                  <li key={provento.idProvento} className="flex items-center justify-between gap-2 py-1.5">
                    <span><strong>{ativo.cdTicker}</strong> <span className="text-slate-500">· {ativo.nmPessoa}</span></span>
                    <span className="flex items-center gap-4"><span className="text-slate-500">{provento.dtPagamento}</span><span className="font-semibold tabular-nums text-green-700">{formatarMoeda(provento.vlTotal)}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}

      {modal?.tipo === "ativo" && (
        <AtivoModal pessoas={pessoas} idPessoaPadrao={idPessoa} onFechar={() => setModal(null)}
          onSalvar={f => executar(() => financeiroService.criarAtivo(f.cdTicker, f.idPessoa, f.nmAtivo || undefined), "Não foi possível adicionar o fundo.")} />
      )}
      {modal?.tipo === "operacao" && ativoModal && (
        <OperacaoModal ativo={ativoModal} onFechar={() => setModal(null)}
          onSalvar={(f: OperacaoForm) => executar(() => financeiroService.registrarOperacao(ativoModal.idAtivo, f), "Não foi possível registrar a operação.")} />
      )}
      {modal?.tipo === "provento" && ativoModal && (
        <ProventoModal ativo={ativoModal} onFechar={() => setModal(null)}
          onSalvar={(f: ProventoForm) => executar(() => financeiroService.registrarProvento(ativoModal.idAtivo, f), "Não foi possível registrar o provento.")} />
      )}
    </div>
  );
}
