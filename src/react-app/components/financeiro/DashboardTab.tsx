import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Settings } from "lucide-react";
import * as XLSX from "xlsx";

import type { FinanceiroCategoria, FinanceiroConfiguracao, FinanceiroPessoa, FinanceiroProjecaoMes } from "@/shared/types";
import ConfiguracaoFinanceiroModal from "@/react-app/components/financeiro/ConfiguracaoFinanceiroModal";
import FaturaCard from "@/react-app/components/financeiro/FaturaCard";
import LancamentoFinanceiroModal from "@/react-app/components/financeiro/LancamentoFinanceiroModal";
import PainelMes from "@/react-app/components/financeiro/PainelMes";
import { useAtalhos } from "@/react-app/hooks/useAtalhos";
import { financeiroService, type LancamentoFinanceiroForm } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { competenciaDaData, deslocarMes, rotuloMes } from "@/react-app/utils/financeiro";
import { avisoConferencia, linhasFechamento, mesesDoPainel } from "@/react-app/utils/financeiroConta";

interface DashboardTabProps {
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  idPessoa: number;
  onGerenciarCadastros: () => void;
  onVerExtrato: () => void;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Último mês fechado (à esquerda) ao lado do mês corrente em projeção (à direita). */
export default function DashboardTab({ pessoas, categorias, idPessoa, onGerenciarCadastros, onVerExtrato }: DashboardTabProps) {
  const hoje = hojeSaoPaulo();
  const mesHoje = competenciaDaData(hoje);
  const [central, setCentral] = useState(mesHoje);
  const { anterior, atual } = mesesDoPainel(central);

  const [esq, setEsq] = useState<FinanceiroProjecaoMes | null>(null);
  const [dir, setDir] = useState<FinanceiroProjecaoMes | null>(null);
  const [config, setConfig] = useState<FinanceiroConfiguracao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [novaFatura, setNovaFatura] = useState<number | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const filtro = idPessoa || undefined;
      const [a, b, c] = await Promise.all([financeiroService.mes(anterior, filtro), financeiroService.mes(atual, filtro), financeiroService.configuracao()]);
      setEsq(a ?? null);
      setDir(b ?? null);
      setConfig(c ?? null);
      setErro(null);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar o dashboard."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [anterior, atual, idPessoa]);

  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (chave: string, acao: () => Promise<unknown>, sucesso?: (r: unknown) => string | null) => {
    setOcupado(chave);
    setAviso(null);
    try {
      const r = await acao();
      setAviso(sucesso?.(r) ?? null);
      await carregar(true);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível concluir a ação."));
      await carregar(true);
    } finally {
      setOcupado(null);
    }
  };

  const fechar = (mes: FinanceiroProjecaoMes) => {
    if (!window.confirm(`Fechar ${rotuloMes(mes.competencia)} com saldo final de ${mes.saldoFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}? Só valem os lançamentos já realizados e os fixos do próximo mês serão gerados.`)) return;
    void executar(`f${mes.competencia}`, () => financeiroService.fecharMes(mes.competencia),
      r => { const n = (r as { recorrenciasGeradas?: number })?.recorrenciasGeradas ?? 0; return n > 0 ? `${rotuloMes(mes.competencia)} fechado. ${n} lançamento(s) fixo(s) do próximo mês criado(s).` : `${rotuloMes(mes.competencia)} fechado.`; });
  };

  const reabrir = (mes: FinanceiroProjecaoMes) => {
    if (!window.confirm(`Reabrir ${rotuloMes(mes.competencia)}? Os lançamentos voltam a poder ser editados.`)) return;
    void executar(`r${mes.competencia}`, () => financeiroService.reabrirMes(mes.competencia), () => `${rotuloMes(mes.competencia)} reaberto.`);
  };

  const salvarLancamento = async (form: LancamentoFinanceiroForm): Promise<string | null> => {
    try {
      await financeiroService.criar(form);
      setNovaFatura(null);
      await carregar(true);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível salvar o lançamento.");
    }
  };

  const atalhos = useMemo(() => ({
    ArrowLeft: () => setCentral(c => deslocarMes(c, -1)),
    ArrowRight: () => setCentral(c => deslocarMes(c, 1)),
    t: () => setCentral(mesHoje),
  }), [mesHoje]);
  useAtalhos(atalhos);

  const exportar = (mes: FinanceiroProjecaoMes) => {
    const planilha = XLSX.utils.json_to_sheet(linhasFechamento(mes), { header: ["Item", "Tipo", "Valor", "Origem"] });
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, mes.competencia);
    XLSX.writeFile(livro, `NordTool_Fechamento_${mes.competencia}.xlsx`);
  };

  const lembrete = avisoConferencia(hoje, config?.nrDiaConferencia ?? 8, esq, anterior, central === mesHoje);
  const projetadoFatura = dir ? dir.saidas.filter(l => l.cdProjecao === "RITMO_FATURA").reduce((s, l) => s + l.projetado, 0) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Navegar entre os meses">
          <button type="button" aria-label="Mês anterior" title="Seta para a esquerda" onClick={() => setCentral(c => deslocarMes(c, -1))} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-40 text-center text-sm font-bold text-slate-700">{rotuloMes(anterior)} · {rotuloMes(atual)}</span>
          <button type="button" aria-label="Próximo mês" title="Seta para a direita" onClick={() => setCentral(c => deslocarMes(c, 1))} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          {central !== mesHoje && <button type="button" onClick={() => setCentral(mesHoje)} className="ml-1 text-xs font-bold text-blue-600 hover:underline">Voltar para hoje</button>}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onVerExtrato} className="text-sm font-bold text-blue-600 hover:underline">Ver extrato</button>
          <button type="button" onClick={() => setAjustes(true)} disabled={!config} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Settings className="h-4 w-4" /> Ajustes
          </button>
        </div>
      </div>

      {idPessoa !== 0 && <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">Mostrando só os lançamentos da pessoa escolhida, sem saldo anterior nem meta. Escolha "Todos" para a conta completa e para fechar o mês.</p>}
      {lembrete && <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> {lembrete}</p>}
      {aviso && <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{aviso}</p>}
      {erro && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{erro}</span>
          <button type="button" onClick={() => { setErro(null); void carregar(); }} className="font-bold underline">Tentar novamente</button>
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : esq && dir ? (
        <div className={`grid items-start gap-4 transition-opacity xl:grid-cols-2 [&>*]:min-w-0 ${atualizando ? "opacity-60" : ""}`}>
          <PainelMes mes={esq} onExportar={() => exportar(esq)} ocupado={ocupado === `f${esq.competencia}` || ocupado === `r${esq.competencia}`}
            onFechar={idPessoa === 0 ? () => fechar(esq) : undefined} onReabrir={idPessoa === 0 ? () => reabrir(esq) : undefined}
            onSaldoInicial={idPessoa === 0 ? v => salvarSaldoInicial(esq.competencia, v) : undefined} />
          <div className="min-w-0 space-y-4">
            <PainelMes mes={dir} destaque onExportar={() => exportar(dir)} ocupado={ocupado === `f${dir.competencia}` || ocupado === `r${dir.competencia}`}
              onFechar={idPessoa === 0 ? () => fechar(dir) : undefined} onReabrir={idPessoa === 0 ? () => reabrir(dir) : undefined}
              onSaldoInicial={idPessoa === 0 ? v => salvarSaldoInicial(dir.competencia, v) : undefined} />
            {config && !dir.fechado && (
              <FaturaCard competencia={atual} categorias={categorias} idPessoa={idPessoa} diaFechamento={config.nrDiaFechamentoFatura}
                projetado={projetadoFatura} onNovaFatura={setNovaFatura} onAlterado={() => void carregar(true)} />
            )}
          </div>
        </div>
      ) : null}

      {ajustes && config && (
        <ConfiguracaoFinanceiroModal configuracao={config} pessoas={pessoas} categorias={categorias}
          onSalvo={setConfig} onAlterado={() => void carregar(true)} onFechar={() => setAjustes(false)} />
      )}
      {novaFatura !== null && (
        <LancamentoFinanceiroModal pessoas={pessoas} categorias={categorias} idPessoaPadrao={idPessoa || null} categoriaPadrao={novaFatura}
          onSalvar={salvarLancamento} onGerenciarCadastros={onGerenciarCadastros} onFechar={() => setNovaFatura(null)} />
      )}
    </div>
  );

  async function salvarSaldoInicial(competencia: string, valor: number | null): Promise<string | null> {
    try {
      await financeiroService.definirSaldoInicial(competencia, valor);
      await carregar(true);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível salvar o saldo anterior.");
    }
  }
}
