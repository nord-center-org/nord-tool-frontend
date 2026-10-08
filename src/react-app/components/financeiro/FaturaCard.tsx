import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";

import type { FinanceiroCategoria, FinanceiroLancamento, FinanceiroLeitura } from "@/shared/types";
import GraficoFatura from "@/react-app/components/financeiro/GraficoFatura";
import { financeiroService } from "@/react-app/services/FinanceiroService";
import { dataBrParaIso, formatarMoeda } from "@/react-app/utils/casamento";
import { lerValor } from "@/react-app/utils/caixinha";
import { classeInput } from "@/react-app/components/casamento/Campo";

interface FaturaCardProps {
  competencia: string;
  categorias: FinanceiroCategoria[];
  idPessoa: number;
  diaFechamento: number;
  projetado: number | null;
  /** Abre o "novo lançamento" já na categoria da fatura. */
  onNovaFatura: (idCategoria: number) => void;
  /** Avisa que o valor mudou, para recalcular a conta do mês. */
  onAlterado: () => void;
}

/** A fatura do cartão do mês corrente: atualizar o valor parcial e ver o ritmo até o fechamento. */
export default function FaturaCard({ competencia, categorias, idPessoa, diaFechamento, projetado, onNovaFatura, onAlterado }: FaturaCardProps) {
  const categoriasFatura = categorias.filter(c => c.cdProjecao === "RITMO_FATURA" && c.inAtivo);
  const [faturas, setFaturas] = useState<FinanceiroLancamento[]>([]);
  const [leituras, setLeituras] = useState<FinanceiroLeitura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fatura = faturas[0];

  const carregar = useCallback(async () => {
    try {
      const lista = await financeiroService.listar({ competencia, idPessoa: idPessoa || undefined });
      const ids = new Set(categoriasFatura.map(c => c.idCategoria));
      const achadas = lista.lancamentos.filter(l => ids.has(l.idCategoria));
      setFaturas(achadas);
      setLeituras(achadas[0] ? await financeiroService.leituras(achadas[0].idLancamento) : []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível carregar a fatura.");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, idPessoa, categorias]);

  useEffect(() => { void carregar(); }, [carregar]);

  const atualizar = async (e: FormEvent) => {
    e.preventDefault();
    const numero = lerValor(valor);
    if (!fatura || numero === null || salvando) return;
    setSalvando(true);
    try {
      await financeiroService.alterar(fatura.idLancamento, {
        dtLancamento: dataBrParaIso(fatura.dtLancamento) ?? fatura.dtLancamento,
        idCategoria: fatura.idCategoria,
        idPessoa: fatura.idPessoa,
        dsLancamento: fatura.dsLancamento ?? undefined,
        vlLancamento: numero,
        inRealizado: fatura.inRealizado,
        nrVersao: fatura.nrVersao,
      });
      setValor("");
      await carregar();
      onAlterado();
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : "Não foi possível atualizar a fatura.");
      void carregar();
    } finally {
      setSalvando(false);
    }
  };

  if (categoriasFatura.length === 0) return null;
  const ultimaLeitura = leituras[leituras.length - 1];

  return (
    <section aria-label="Fatura do cartão" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Ritmo da fatura</h3>
      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : !fatura ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">A fatura deste mês ainda não foi lançada.</p>
          <button type="button" onClick={() => onNovaFatura(categoriasFatura[0].idCategoria)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Lançar fatura
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={e => void atualizar(e)} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs text-slate-500">Valor atual</p>
              <p className="text-2xl font-black tabular-nums text-slate-900">{formatarMoeda(fatura.vlLancamento)}</p>
              {ultimaLeitura && <p className="text-xs text-slate-400">atualizada em {ultimaLeitura.dtLeitura}</p>}
            </div>
            <label className="ml-auto flex flex-col gap-1 text-xs font-bold text-slate-500">
              Novo valor (R$)
              <input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={`${classeInput} w-36`} />
            </label>
            <button type="submit" disabled={salvando || lerValor(valor) === null}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Atualizar
            </button>
          </form>
          {erro && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div className="mt-3">
            <GraficoFatura leituras={leituras} competencia={competencia} diaFechamento={diaFechamento} projetado={projetado} />
          </div>
        </>
      )}
    </section>
  );
}
