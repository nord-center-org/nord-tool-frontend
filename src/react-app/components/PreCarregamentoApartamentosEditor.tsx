import { useState } from "react";
import { X } from "lucide-react";

import {
  COLUNAS_PRE_CARREGAMENTO, TOKEN_AMANHA, TOKEN_HOJE, alternarValor, montarPreCarregamento,
  type ColunaPreCarregamento, type PreCarregamento,
} from "@/react-app/utils/preCarregamentoApartamentos";
import { VALOR_VAZIO } from "@/react-app/utils/filtroColuna";

interface EditorProps {
  valor: PreCarregamento;
  onChange: (novo: PreCarregamento) => void;
  /** Nomes de status conhecidos (a lista da API entra aqui; pode vir vazia). */
  statusOpcoes: string[];
}

interface Opcao { valor: string; rotulo: string }

const STATUS_PADRAO = ["Não Liberado", "Liberado", "Agendado", "Aprovado", "Reprovado", "Pendente", "Aprovado DAT", "Pendente DAT"];
const TERMO_OPCOES: Opcao[] = ["Sem termo", "Pendente", "Em andamento", "Concluído"].map(v => ({ valor: v, rotulo: v }));
const DATA_OPCOES: Opcao[] = [
  { valor: TOKEN_HOJE, rotulo: "Hoje" },
  { valor: TOKEN_AMANHA, rotulo: "Amanhã" },
  { valor: VALOR_VAZIO, rotulo: "Sem data" },
];

/** Colunas com valores livres (digitados), com um texto de ajuda e as opções fixas que valem para elas. */
const LIVRES: Partial<Record<ColunaPreCarregamento, { ajuda: string; placeholder: string; fixas: Opcao[]; tipo?: string }>> = {
  apartamento: { ajuda: "Contém o texto (ex.: N1-01 pega todos do bloco).", placeholder: "Ex.: N1-01", fixas: [] },
  data: { ajuda: "Hoje e Amanhã se atualizam sozinhos; ou escolha datas fixas.", placeholder: "", fixas: DATA_OPCOES, tipo: "date" },
  horario: { ajuda: "Horário exato, como aparece na tabela.", placeholder: "Ex.: 14:00", fixas: [{ valor: VALOR_VAZIO, rotulo: "Sem horário" }], tipo: "time" },
  observacao: { ajuda: "Contém o texto.", placeholder: "Ex.: chave", fixas: [{ valor: VALOR_VAZIO, rotulo: "Sem observação" }] },
  fotos: { ajuda: "Exatamente como aparece na tabela (ex.: 3 fotos).", placeholder: "Ex.: 3 fotos", fixas: [{ valor: VALOR_VAZIO, rotulo: "Sem termo" }] },
};

const paraBr = (iso: string) => iso.split("-").reverse().join("/");

function Ficha({ texto, onRemover }: { texto: string; onRemover: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
      {texto}
      <button type="button" onClick={onRemover} aria-label={`Remover ${texto}`} className="rounded-full p-0.5 hover:bg-blue-100"><X className="h-3 w-3" /></button>
    </span>
  );
}

function Caixas({ opcoes, selecionados, onAlternar }: { opcoes: Opcao[]; selecionados: string[]; onAlternar: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {opcoes.map(o => (
        <label key={o.valor} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
          <input type="checkbox" checked={selecionados.includes(o.valor)} onChange={() => onAlternar(o.valor)} className="rounded text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-slate-700">{o.rotulo}</span>
        </label>
      ))}
    </div>
  );
}

/** Escolhe, para CADA coluna da tabela de Apartamentos, o filtro que já abre aplicado, e a ordenação inicial. */
export default function PreCarregamentoApartamentosEditor({ valor, onChange, statusOpcoes }: EditorProps) {
  const [rascunhos, setRascunhos] = useState<Partial<Record<ColunaPreCarregamento, string>>>({});
  const opcoesStatus = [...new Set([...STATUS_PADRAO, ...statusOpcoes])].map(v => ({ valor: v, rotulo: v }));

  const definir = (coluna: ColunaPreCarregamento, valores: string[]) =>
    onChange(montarPreCarregamento({ ...valor.filtros, [coluna]: valores }, valor.ordenacao));

  const adicionar = (coluna: ColunaPreCarregamento, texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    const final = LIVRES[coluna]?.tipo === "date" && /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? paraBr(limpo) : limpo;
    const atuais = valor.filtros[coluna] ?? [];
    if (!atuais.includes(final)) definir(coluna, [...atuais, final]);
    setRascunhos(r => ({ ...r, [coluna]: "" }));
  };

  const rotuloFicha = (coluna: ColunaPreCarregamento, v: string) =>
    LIVRES[coluna]?.fixas.find(f => f.valor === v)?.rotulo ?? v;

  const total = Object.keys(valor.filtros).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {total === 0 ? "Nenhum filtro será aplicado ao abrir." : `${total} coluna(s) com filtro ao abrir.`} Se nenhum valor escolhido existir nos dados, aquele filtro é ignorado.
        </p>
        {total > 0 && (
          <button type="button" onClick={() => onChange({ filtros: {}, ordenacao: valor.ordenacao })} className="text-xs font-bold text-blue-600 hover:underline">Limpar todos</button>
        )}
      </div>

      {COLUNAS_PRE_CARREGAMENTO.map(({ coluna, rotulo }) => {
        const selecionados = valor.filtros[coluna] ?? [];
        const livre = LIVRES[coluna];
        return (
          <fieldset key={coluna} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{rotulo}</legend>
            {coluna === "status" && <Caixas opcoes={opcoesStatus} selecionados={selecionados} onAlternar={v => definir(coluna, alternarValor(selecionados, v))} />}
            {coluna === "termo" && <Caixas opcoes={TERMO_OPCOES} selecionados={selecionados} onAlternar={v => definir(coluna, alternarValor(selecionados, v))} />}
            {livre && (
              <>
                {livre.fixas.length > 0 && <Caixas opcoes={livre.fixas} selecionados={selecionados} onAlternar={v => definir(coluna, alternarValor(selecionados, v))} />}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type={livre.tipo ?? "text"}
                    aria-label={`Adicionar valor em ${rotulo}`}
                    value={rascunhos[coluna] ?? ""}
                    placeholder={livre.placeholder}
                    onChange={e => setRascunhos(r => ({ ...r, [coluna]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(coluna, rascunhos[coluna] ?? ""); } }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button type="button" onClick={() => adicionar(coluna, rascunhos[coluna] ?? "")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Adicionar</button>
                </div>
                <p className="text-xs text-slate-400">{livre.ajuda}</p>
                {selecionados.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selecionados.map(v => <Ficha key={v} texto={rotuloFicha(coluna, v)} onRemover={() => definir(coluna, selecionados.filter(x => x !== v))} />)}
                  </div>
                )}
              </>
            )}
          </fieldset>
        );
      })}

      <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Ordenação ao abrir</legend>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Ordenar por"
            value={valor.ordenacao?.coluna ?? ""}
            onChange={e => {
              const coluna = e.target.value as ColunaPreCarregamento | "";
              onChange({ ...valor, ordenacao: coluna ? { coluna, direcao: valor.ordenacao?.direcao ?? "asc" } : null });
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">Padrão (Data, crescente)</option>
            {COLUNAS_PRE_CARREGAMENTO.map(c => <option key={c.coluna} value={c.coluna}>{c.rotulo}</option>)}
          </select>
          <select
            aria-label="Direção da ordenação"
            value={valor.ordenacao?.direcao ?? "asc"}
            disabled={!valor.ordenacao}
            onChange={e => valor.ordenacao && onChange({ ...valor, ordenacao: { ...valor.ordenacao, direcao: e.target.value as "asc" | "desc" } })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none disabled:opacity-50"
          >
            <option value="asc">Crescente (A→Z, mais antigo primeiro)</option>
            <option value="desc">Decrescente (Z→A, mais recente primeiro)</option>
          </select>
        </div>
      </fieldset>
    </div>
  );
}
