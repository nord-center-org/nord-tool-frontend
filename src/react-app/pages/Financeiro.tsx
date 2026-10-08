import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { LineChart, Loader2, ReceiptText, Wallet } from "lucide-react";

import type { FinanceiroCategoria, FinanceiroPessoa } from "@/shared/types";
import CadastrosFinanceiroModal from "@/react-app/components/financeiro/CadastrosFinanceiroModal";
import ExtratoTab from "@/react-app/components/financeiro/ExtratoTab";
import { financeiroService } from "@/react-app/services/FinanceiroService";

type Aba = "dashboard" | "extrato" | "investimentos";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "dashboard", rotulo: "Dashboard" },
  { id: "extrato", rotulo: "Extrato" },
  { id: "investimentos", rotulo: "Investimentos" },
];

const FILTRO_PESSOA = "@NordTool:financeiro_filtro_pessoa";

function lerFiltroPessoa(): number {
  try {
    return Number(localStorage.getItem(FILTRO_PESSOA)) || 0;
  } catch {
    return 0;
  }
}

function gravarFiltroPessoa(id: number) {
  try { localStorage.setItem(FILTRO_PESSOA, String(id)); } catch { /* sem armazenamento: segue sem lembrar */ }
}

function EmBreve({ titulo, descricao, icone }: { titulo: string; descricao: string; icone: "dashboard" | "investimentos" }) {
  const Icone = icone === "dashboard" ? ReceiptText : LineChart;
  return (
    <section aria-label={titulo} className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Icone className="mx-auto h-8 w-8 text-slate-300" />
      <h2 className="mt-3 text-lg font-bold text-slate-700">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-500">{descricao}</p>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Em breve</p>
    </section>
  );
}

export default function FinanceiroPage() {
  const [params, setParams] = useSearchParams();
  const aba: Aba = ABAS.some(a => a.id === params.get("aba")) ? (params.get("aba") as Aba) : "extrato";

  const [pessoas, setPessoas] = useState<FinanceiroPessoa[]>([]);
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [idPessoa, setIdPessoa] = useState(lerFiltroPessoa);
  const [cadastros, setCadastros] = useState(false);

  const carregarCadastros = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [p, c] = await Promise.all([financeiroService.pessoas(), financeiroService.categorias()]);
      setPessoas(p);
      setCategorias(c);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível carregar o Financeiro.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregarCadastros(); }, [carregarCadastros]);

  // Um filtro salvo de pessoa que não existe mais (ou foi desativada) volta para "Todos".
  const pessoaValida = idPessoa === 0 || pessoas.some(p => p.idPessoa === idPessoa && p.inAtivo);
  const idPessoaEfetivo = pessoaValida ? idPessoa : 0;

  const escolherPessoa = (id: number) => { setIdPessoa(id); gravarFiltroPessoa(id); };
  const escolherAba = (nova: Aba) => setParams(nova === "extrato" ? {} : { aba: nova }, { replace: true });

  const classeChip = (ativo: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${ativo ? "bg-blue-600 text-white shadow" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-4 max-w-7xl rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-blue-400">Financeiro</h1>
              <p className="text-sm text-slate-400">Fechamento do mês, extrato e investimentos</p>
            </div>
          </div>
          <div role="tablist" aria-label="Seções do Financeiro" className="flex w-full gap-1 rounded-xl bg-slate-800 p-1 sm:inline-flex sm:w-auto">
            {ABAS.map(a => (
              <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => escolherAba(a.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold sm:flex-none sm:px-4 sm:text-sm ${aba === a.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-300 hover:text-white"}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="De quem">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">De quem</span>
          <button type="button" aria-pressed={idPessoaEfetivo === 0} onClick={() => escolherPessoa(0)} className={classeChip(idPessoaEfetivo === 0)}>Todos</button>
          {pessoas.filter(p => p.inAtivo).map(p => (
            <button key={p.idPessoa} type="button" aria-pressed={idPessoaEfetivo === p.idPessoa} onClick={() => escolherPessoa(p.idPessoa)} className={classeChip(idPessoaEfetivo === p.idPessoa)}>
              {p.nmPessoa}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
        ) : erro ? (
          <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar o Financeiro</h3>
            <p className="mt-1 text-sm text-slate-500">{erro}</p>
            <button type="button" onClick={() => void carregarCadastros()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
          </div>
        ) : (
          <>
            {aba === "extrato" && (
              <ExtratoTab pessoas={pessoas} categorias={categorias} idPessoa={idPessoaEfetivo} onGerenciarCadastros={() => setCadastros(true)} />
            )}
            {aba === "dashboard" && (
              <EmBreve icone="dashboard" titulo="Dashboard do mês"
                descricao="O último mês fechado ao lado da estimativa do mês corrente, com a projeção de quanto vai sobrar." />
            )}
            {aba === "investimentos" && (
              <EmBreve icone="investimentos" titulo="Investimentos"
                descricao="Seus fundos imobiliários com a cota em tempo real e os dividendos a receber." />
            )}
          </>
        )}
      </main>

      {cadastros && (
        <CadastrosFinanceiroModal pessoas={pessoas} categorias={categorias} onAlterado={() => void carregarCadastros(true)} onFechar={() => setCadastros(false)} />
      )}
    </div>
  );
}
