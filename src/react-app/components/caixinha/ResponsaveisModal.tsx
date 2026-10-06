import { useState, type FormEvent } from "react";

import type { CaixinhaResponsavel } from "@/shared/types";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { classeInput } from "@/react-app/components/casamento/Campo";
import { caixinhaService } from "@/react-app/services/CaixinhaService";

interface ResponsaveisModalProps {
  responsaveis: CaixinhaResponsavel[];
  /** Chamado após qualquer mudança, para a página recarregar a lista. */
  onAlterado: () => void;
  onFechar: () => void;
}

/** Lista fechada de responsáveis: adicionar e ativar/desativar (desativados somem do select). */
export default function ResponsaveisModal({ responsaveis, onAlterado, onFechar }: ResponsaveisModalProps) {
  const [itens, setItens] = useState(responsaveis);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

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

  const adicionar = (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome.");
    void executar(async () => {
      const criado = await caixinhaService.criarResponsavel(nome.trim());
      setItens(l => [...l, criado]);
      setNome("");
    });
  };

  const alternar = (r: CaixinhaResponsavel) => void executar(async () => {
    const atualizado = await caixinhaService.atualizarResponsavel(r.idResponsavel, { inAtivo: !r.inAtivo });
    setItens(l => l.map(x => (x.idResponsavel === r.idResponsavel ? atualizado : x)));
  });

  return (
    <ModalBase titulo="Responsáveis" onFechar={onFechar}>
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <form onSubmit={adicionar} className="flex gap-2">
          <input value={nome} maxLength={100} onChange={e => setNome(e.target.value)} placeholder="Novo responsável" aria-label="Novo responsável" className={classeInput} />
          <button type="submit" disabled={ocupado} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">Adicionar</button>
        </form>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {itens.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nenhum responsável cadastrado.</li>}
          {itens.map(r => (
            <li key={r.idResponsavel} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className={`text-sm font-medium ${r.inAtivo ? "text-slate-700" : "text-slate-400 line-through"}`}>{r.nmResponsavel}</span>
              <button type="button" disabled={ocupado} onClick={() => alternar(r)}
                className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${r.inAtivo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {r.inAtivo ? "Ativo" : "Inativo"}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" onClick={onFechar} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">Fechar</button>
        </div>
      </div>
    </ModalBase>
  );
}
