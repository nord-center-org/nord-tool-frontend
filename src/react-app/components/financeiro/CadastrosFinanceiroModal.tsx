import { useState, type FormEvent } from "react";

import type { FinanceiroCategoria, FinanceiroPessoa, RegraData, TipoFluxo, TipoProjecao } from "@/shared/types";
import { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { financeiroService } from "@/react-app/services/FinanceiroService";
import { ROTULO_PROJECAO, ROTULO_REGRA_DATA, ROTULO_TIPO, projecoesDoTipo } from "@/react-app/utils/financeiro";

interface CadastrosFinanceiroModalProps {
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  /** Chamado após qualquer mudança, para a página recarregar os cadastros. */
  onAlterado: () => void;
  onFechar: () => void;
}

type Aba = "pessoas" | "categorias";

const classeAba = (ativa: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-bold ${ativa ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`;

/** Cadastros do Financeiro: pessoas (de quem é o lançamento) e categorias, com ativar/desativar. */
export default function CadastrosFinanceiroModal({ pessoas, categorias, onAlterado, onFechar }: CadastrosFinanceiroModalProps) {
  const [aba, setAba] = useState<Aba>("pessoas");
  const [listaPessoas, setListaPessoas] = useState(pessoas);
  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [nomePessoa, setNomePessoa] = useState("");
  const [compartilhada, setCompartilhada] = useState(false);

  const [nomeCategoria, setNomeCategoria] = useState("");
  const [tipo, setTipo] = useState<TipoFluxo>("SAIDA");
  const [projecao, setProjecao] = useState<TipoProjecao>("MANUAL");
  const [fixa, setFixa] = useState(false);
  const [regra, setRegra] = useState<RegraData | "">("");
  const [dia, setDia] = useState("");

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      onAlterado();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  };

  const adicionarPessoa = (e: FormEvent) => {
    e.preventDefault();
    if (!nomePessoa.trim()) return setErro("Informe o nome.");
    void executar(async () => {
      const criada = await financeiroService.criarPessoa({ nmPessoa: nomePessoa.trim(), inCompartilhado: compartilhada, nrOrdem: listaPessoas.length + 1 });
      setListaPessoas(l => [...l, criada]);
      setNomePessoa("");
      setCompartilhada(false);
    });
  };

  const alternarPessoa = (p: FinanceiroPessoa) => void executar(async () => {
    const atualizada = await financeiroService.atualizarPessoa(p.idPessoa, { inAtivo: !p.inAtivo });
    setListaPessoas(l => l.map(x => (x.idPessoa === p.idPessoa ? atualizada : x)));
  });

  const trocarTipo = (novo: TipoFluxo) => {
    setTipo(novo);
    if (!projecoesDoTipo(novo).includes(projecao)) setProjecao("MANUAL");
  };

  const adicionarCategoria = (e: FormEvent) => {
    e.preventDefault();
    if (!nomeCategoria.trim()) return setErro("Informe o nome.");
    if (regra && !(Number(dia) >= 1)) return setErro("Informe o dia da regra de data.");
    void executar(async () => {
      const criada = await financeiroService.criarCategoria({
        nmCategoria: nomeCategoria.trim(), cdTipo: tipo, cdProjecao: projecao, inFixa: fixa,
        cdRegraData: regra, nrDia: regra ? Number(dia) : null, nrOrdem: listaCategorias.filter(c => c.cdTipo === tipo).length + 1,
      });
      setListaCategorias(l => [...l, criada]);
      setNomeCategoria("");
      setFixa(false);
      setRegra("");
      setDia("");
    });
  };

  const alternarCategoria = (c: FinanceiroCategoria) => void executar(async () => {
    const atualizada = await financeiroService.atualizarCategoria(c.idCategoria, { inAtivo: !c.inAtivo });
    setListaCategorias(l => l.map(x => (x.idCategoria === c.idCategoria ? atualizada : x)));
  });

  const botaoAtivo = (ativo: boolean, onClick: () => void) => (
    <button type="button" disabled={ocupado} onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      {ativo ? "Ativa" : "Inativa"}
    </button>
  );

  return (
    <ModalBase titulo="Pessoas e categorias" onFechar={onFechar} largura="max-w-xl">
      <div className="space-y-4">
        <div role="tablist" aria-label="Cadastros" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          <button type="button" role="tab" aria-selected={aba === "pessoas"} onClick={() => setAba("pessoas")} className={classeAba(aba === "pessoas")}>Pessoas</button>
          <button type="button" role="tab" aria-selected={aba === "categorias"} onClick={() => setAba("categorias")} className={classeAba(aba === "categorias")}>Categorias</button>
        </div>
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {aba === "pessoas" ? (
          <>
            <p className="text-xs text-slate-400">"De quem é" cada lançamento. Quem digitou fica registrado à parte, pelo login.</p>
            <form onSubmit={adicionarPessoa} className="flex flex-wrap items-center gap-2">
              <input value={nomePessoa} maxLength={100} onChange={e => setNomePessoa(e.target.value)} placeholder="Nova pessoa" aria-label="Nova pessoa" className={`${classeInput} min-w-[10rem] flex-1`} />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={compartilhada} onChange={e => setCompartilhada(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Compartilhada</label>
              <button type="submit" disabled={ocupado} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">Adicionar</button>
            </form>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {listaPessoas.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma pessoa cadastrada.</li>}
              {listaPessoas.map(p => (
                <li key={p.idPessoa} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className={`text-sm font-medium ${p.inAtivo ? "text-slate-700" : "text-slate-400 line-through"}`}>
                    {p.nmPessoa}{p.inCompartilhado && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">compartilhada</span>}
                  </span>
                  {botaoAtivo(p.inAtivo, () => alternarPessoa(p))}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <form onSubmit={adicionarCategoria} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap gap-2">
                <input value={nomeCategoria} maxLength={100} onChange={e => setNomeCategoria(e.target.value)} placeholder="Nova categoria" aria-label="Nova categoria" className={`${classeInput} min-w-[10rem] flex-1`} />
                <select value={tipo} onChange={e => trocarTipo(e.target.value as TipoFluxo)} aria-label="Tipo" className={`${classeInput} w-auto`}>
                  {(Object.keys(ROTULO_TIPO) as TipoFluxo[]).map(t => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={projecao} onChange={e => setProjecao(e.target.value as TipoProjecao)} aria-label="Como projetar" className={`${classeInput} min-w-[12rem] flex-1`}>
                  {projecoesDoTipo(tipo).map(p => <option key={p} value={p}>{ROTULO_PROJECAO[p]}</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={fixa} onChange={e => setFixa(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Fixa todo mês</label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={regra} onChange={e => setRegra(e.target.value as RegraData | "")} aria-label="Quando cai" className={`${classeInput} w-auto`}>
                  <option value="">Sem data fixa</option>
                  {(Object.keys(ROTULO_REGRA_DATA) as RegraData[]).map(r => <option key={r} value={r}>{ROTULO_REGRA_DATA[r]}</option>)}
                </select>
                {regra && <input type="number" min={1} max={regra === "DIA_UTIL" ? 23 : 31} value={dia} onChange={e => setDia(e.target.value)} aria-label="Dia" placeholder={regra === "DIA_UTIL" ? "Ex.: 5º" : "Ex.: 20"} className={`${classeInput} w-24`} />}
                <button type="submit" disabled={ocupado} className="ml-auto shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">Adicionar</button>
              </div>
            </form>
            {(["ENTRADA", "SAIDA"] as TipoFluxo[]).map(t => (
              <section key={t} aria-label={`Categorias de ${ROTULO_TIPO[t].toLowerCase()}`}>
                <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{ROTULO_TIPO[t]}s</h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {listaCategorias.filter(c => c.cdTipo === t).map(c => (
                    <li key={c.idCategoria} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className={`block truncate text-sm font-medium ${c.inAtivo ? "text-slate-700" : "text-slate-400 line-through"}`}>{c.nmCategoria}</span>
                        <span className="block text-xs text-slate-400">
                          {ROTULO_PROJECAO[c.cdProjecao]}{c.cdRegraData && c.nrDia ? ` · ${c.cdRegraData === "DIA_UTIL" ? `${c.nrDia}º dia útil` : `dia ${c.nrDia}`}` : ""}
                        </span>
                      </span>
                      {botaoAtivo(c.inAtivo, () => alternarCategoria(c))}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onFechar} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">Fechar</button>
        </div>
      </div>
    </ModalBase>
  );
}
