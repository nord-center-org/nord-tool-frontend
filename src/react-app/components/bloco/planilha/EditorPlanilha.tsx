import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Sheet as AbaEditor } from "@fortune-sheet/core";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import * as XLSX from "xlsx";
import { ArrowLeft, Check, Download, Loader2, Sheet } from "lucide-react";

import { aplicarPortugues } from "@/react-app/components/bloco/planilha/idiomaPlanilha";
import { baixarArquivo, nomeDeArquivo } from "@/react-app/utils/baixarArquivo";
import { ApiError } from "@/react-app/services/apiClient";
import { arquivosBlocoService as servico, type ArquivoBloco } from "@/react-app/services/BlocoNotasService";
import { MAX_BYTES_PLANILHA, abasParaSalvar, abasParaXlsx, formulaParaIngles, lerPlanilha, numeroPtBr, temFormulaEmPortugues, type AbaFs } from "@/react-app/utils/planilha";

aplicarPortugues();

type Estado = "salvo" | "sujo" | "salvando" | "erro" | "conflito" | "grande";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/**
 * Planilha do bloco de notas (v3), no estilo do Google Sheets: várias páginas, fórmulas (também em português, como
 * =SOMA(A1:A3) e =SE(A1>0;"sim";"não")), formatação, mesclar, congelar, filtro, classificar, comentários e links.
 * Salva sozinha 1,5 s depois da última mudança, com versão; baixa em Excel (.xlsx).
 */
export default function EditorPlanilha({ id, onVoltar, onAlterado }: { id: number; onVoltar: () => void; onAlterado?: (a: ArquivoBloco) => void }) {
  const [arquivo, setArquivo] = useState<ArquivoBloco | null>(null);
  const [inicial, setInicial] = useState<AbaFs[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("salvo");
  const [titulo, setTitulo] = useState("");
  const versao = useRef(1);
  const atual = useRef<AbaFs[] | null>(null);
  const timer = useRef<number | null>(null);
  const salvando = useRef(false);
  const pendente = useRef(false);
  const ultimoSalvo = useRef<string>("");
  const wb = useRef<WorkbookInstance>(null);

  useEffect(() => {
    let vivo = true;
    servico.abrir(id).then(a => {
      if (!vivo) return;
      setArquivo(a); setTitulo(a.nmTitulo); versao.current = a.nrVersao;
      const abas = lerPlanilha(a.conteudo);
      atual.current = abas;
      ultimoSalvo.current = JSON.stringify(abasParaSalvar(abas));
      setInicial(abas);
    }).catch(e => vivo && setErro(mensagem(e, "Não foi possível abrir a planilha.")));
    return () => { vivo = false; };
  }, [id]);

  const salvar = useCallback(async (extra?: { nmTitulo?: string }) => {
    if (salvando.current) { pendente.current = true; return; }
    const abas = atual.current;
    if (!abas) return;
    const conteudo = JSON.stringify(abasParaSalvar(abas));
    // O editor avisa mudança até ao abrir: sem diferença de verdade, não salva.
    if (conteudo === ultimoSalvo.current && !extra) { setEstado("salvo"); return; }
    if (new Blob([conteudo]).size > MAX_BYTES_PLANILHA) { setEstado("grande"); return; }
    salvando.current = true;
    setEstado("salvando");
    try {
      const r = await servico.salvar(id, versao.current, { conteudo, ...extra });
      versao.current = r.nrVersao;
      ultimoSalvo.current = conteudo;
      onAlterado?.(r);
      setEstado(pendente.current ? "sujo" : "salvo");
    } catch (e) {
      setEstado(e instanceof ApiError && e.status === 409 ? "conflito" : "erro");
    } finally {
      salvando.current = false;
      if (pendente.current) { pendente.current = false; void salvar(); }
    }
  }, [id, onAlterado]);

  // O editor chama onChange até quando a tela só redesenha: o estado só muda quando há o que salvar (senão vira laço).
  const agendar = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvar(), 1500);
  }, [salvar]);

  // Salva o que faltar ao sair.
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); void salvar(); } }, [salvar]);

  const hooks = useMemo(() => ({
    // Fórmula em português: troca pela do editor e deixa a célula com a fórmula traduzida.
    beforeUpdateCell: (r: number, c: number, valor: unknown) => {
      // "30,5" e "1.234,56" são números, como no Sheets em português.
      const numero = numeroPtBr(valor);
      if (numero !== null) { window.setTimeout(() => wb.current?.setCellValue(r, c, numero), 0); return false; }
      if (!temFormulaEmPortugues(valor)) return true;
      const traduzida = formulaParaIngles(valor);
      window.setTimeout(() => wb.current?.setCellValue(r, c, traduzida), 0);
      return false;
    },
  }), []);

  const baixar = () => {
    if (!atual.current) return;
    const nome = nomeDeArquivo(titulo, "planilha");
    const bytes = XLSX.write(abasParaXlsx(atual.current), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    baixarArquivo(new File([bytes], `${nome}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  };

  const renomear = () => {
    const t = titulo.trim();
    if (!t || !arquivo || t === arquivo.nmTitulo) { setTitulo(arquivo?.nmTitulo ?? t); return; }
    setArquivo({ ...arquivo, nmTitulo: t });
    if (timer.current) window.clearTimeout(timer.current);
    void salvar({ nmTitulo: t });
  };

  if (erro) return <div className="p-4"><p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p><button type="button" className={`${botao} mt-3`} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Voltar</button></div>;
  if (!arquivo || !inicial) return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo a planilha…</div>;

  const rotulo: Record<Estado, React.ReactNode> = {
    salvo: <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" />Salvo</span>,
    sujo: <span className="text-slate-400">Alterado…</span>,
    salvando: <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando</span>,
    erro: <button type="button" className="font-bold text-red-600 underline" onClick={() => void salvar()}>Não salvou. Tentar de novo</button>,
    conflito: <span className="text-red-600">Mudou em outro aparelho</span>,
    grande: <span className="text-red-600">Passou de 5 MB: apague algo para salvar</span>,
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-2 md:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Bloco de notas</button>
        <Sheet className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <input value={titulo} maxLength={120} aria-label="Nome da planilha" onChange={e => setTitulo(e.target.value)} onBlur={renomear}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="order-last w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none sm:order-none sm:w-auto sm:flex-1" />
        <span className="ml-auto text-xs font-bold sm:ml-0" aria-live="polite">{rotulo[estado]}</span>
        <button type="button" className={botao} onClick={baixar}><Download className="h-3.5 w-3.5" />Baixar Excel</button>
      </div>
      {estado === "conflito" && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta planilha foi alterada em outro aparelho e o que você mudou aqui não foi salvo.
          <button type="button" className={botao} onClick={() => window.location.reload()}>Ver a versão mais nova</button>
        </p>
      )}
      <div className="planilha-bloco relative min-h-[20rem] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white" data-planilha="">
        <Workbook ref={wb} data={inicial as unknown as AbaEditor[]} lang="en" currency="R$" hooks={hooks}
          onChange={dados => { atual.current = dados as unknown as AbaFs[]; agendar(); }} />
      </div>
    </div>
  );
}
