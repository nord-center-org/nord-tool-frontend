import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Sheet as AbaEditor } from "@fortune-sheet/core";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Download, Loader2, Sheet } from "lucide-react";

import { aplicarPortugues } from "@/react-app/components/bloco/planilha/idiomaPlanilha";
import { baixarArquivo, nomeDeArquivo } from "@/react-app/utils/baixarArquivo";
import { colunaDaBorda, larguraIdeal } from "@/react-app/utils/larguraColuna";
import { ajustarFormula, blocoDoMovimento, girarBloco, type Direcao, type Eixo } from "@/react-app/utils/moverPlanilha";
import { ApiError } from "@/react-app/services/apiClient";
import { arquivosBlocoService as servico, type ArquivoBloco } from "@/react-app/services/BlocoNotasService";
import {
  MAX_BYTES_PLANILHA, abasParaSalvar, abasParaXlsx, dataPtBr, lerPlanilha, normalizarFormula, numeroPtBr, precisaNormalizar, prepararAbas, textoNaTela, type AbaFs,
} from "@/react-app/utils/planilha";

aplicarPortugues();

type Estado = "salvo" | "sujo" | "salvando" | "erro" | "conflito" | "grande";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/**
 * Planilha do bloco de notas (v3), no estilo do Google Sheets: várias páginas, fórmulas (também em português, como
 * =SOMA(A1:A3) e =SE(A1>0;"sim";"não")), formatação, mesclar, congelar, filtro, classificar, comentários e links.
 * Salva sozinha 1,5 s depois da última mudança, com versão; baixa em Excel (.xlsx).
 */
export default function EditorPlanilha({ id, onVoltar, onAlterado, extra }: { id: number; onVoltar: () => void; onAlterado?: (a: ArquivoBloco) => void; extra?: ReactNode }) {
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
  const caixa = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    servico.abrir(id).then(a => {
      if (!vivo) return;
      setArquivo(a); setTitulo(a.nmTitulo); versao.current = a.nrVersao;
      // Fórmulas em português (as de antes da v5 eram em inglês) e a lista das células com fórmula, para recalcular.
      const abas = prepararAbas(lerPlanilha(a.conteudo));
      atual.current = abas;
      ultimoSalvo.current = JSON.stringify(abasParaSalvar(abas));
      setInicial(abas);
    }).catch(e => vivo && setErro(mensagem(e, "Não foi possível abrir a planilha.")));
    return () => { vivo = false; };
  }, [id]);

  // v4: fórmulas sem resultado (planilha criada pelo chat dos cadernos): calcula ao abrir, aba por aba.
  useEffect(() => {
    if (!inicial) return;
    const semResultado = inicial.filter(a => a.id && (a.celldata ?? []).some(c => c.v?.f && (c.v.v === null || c.v.v === undefined)));
    if (!semResultado.length) return;
    const t = window.setTimeout(() => {
      for (const a of semResultado) {
        try { wb.current?.calculateFormula(a.id); } catch { /* fórmula inválida: o editor mostra o erro na célula */ }
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [inicial]);

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
    // O que se digita como no Sheets em português vira o que o editor entende.
    beforeUpdateCell: (r: number, c: number, valor: unknown) => {
      // "30,5" e "1.234,56" são números.
      const numero = numeroPtBr(valor);
      if (numero !== null) { window.setTimeout(() => wb.current?.setCellValue(r, c, numero), 0); return false; }
      // "11/11/2026" (e com hora) é data no formato brasileiro, não mês/dia.
      const data = dataPtBr(valor);
      if (data) {
        window.setTimeout(() => {
          wb.current?.setCellValue(r, c, data.iso);
          wb.current?.setCellFormat(r, c, "ct", { fa: data.formato, t: "d" });
        }, 0);
        return false;
      }
      // Fórmula: nome em português, ";" e vírgula decimal (=SOMA(A1;B1*1,5)) ficam no formato que o editor guarda.
      if (!precisaNormalizar(valor)) return true;
      const formula = normalizarFormula(valor);
      window.setTimeout(() => wb.current?.setCellValue(r, c, formula), 0);
      return false;
    },
    // Na tela, como no Sheets em português: vírgula decimal, ponto de milhar, VERDADEIRO/FALSO e #NOME?, #VALOR!…
    beforeRenderCellArea: (_celulas: unknown, ctx: CanvasRenderingContext2D) => {
      const tela = ctx as CanvasRenderingContext2D & { __ptBr?: boolean };
      if (!tela.__ptBr) {
        const escrever = tela.fillText.bind(tela);
        tela.fillText = (texto: string, x: number, y: number, largura?: number) =>
          largura === undefined ? escrever(textoNaTela(String(texto)), x, y) : escrever(textoNaTela(String(texto)), x, y, largura);
        tela.__ptBr = true;
      }
      return true;
    },
  }), []);

  // Shift + roda do mouse rola para os lados. O Chrome (Windows/Linux) manda isso como deltaY com shiftKey, e o editor
  // só rola na horizontal com deltaX: reenvia o mesmo giro como horizontal.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (!e.shiftKey || (e as WheelEvent & { __nt?: boolean }).__nt) return;
      if (e.deltaY === 0 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      e.stopPropagation();
      const lateral = new WheelEvent("wheel", { deltaX: e.deltaY, deltaY: 0, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true });
      (lateral as WheelEvent & { __nt?: boolean }).__nt = true;
      e.target?.dispatchEvent(lateral);
    };
    el.addEventListener("wheel", roda, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", roda, { capture: true });
  }, [inicial]);

  /**
   * Move as linhas (ou colunas) selecionadas uma posição, como Alt+Shift+setas no Google Sheets: as células vão
   * inteiras (valor, fórmula e formato), a largura/altura acompanha e as fórmulas da página passam a apontar para as
   * mesmas células de antes.
   */
  const mover = useCallback((eixo: Eixo, direcao: Direcao) => {
    const w = wb.current;
    if (!w) return;
    setAviso(null);
    const sel = w.getSelection()?.[0];
    const folha = w.getSheet();
    const dados = folha.data;
    if (!sel || !dados?.length || !folha.id) { setAviso("Selecione as linhas ou colunas que quer mover."); return; }
    const linhas = dados.length, colunas = dados[0]?.length ?? 0;
    const [inicio, fim] = eixo === "linha" ? sel.row : sel.column;
    const m = { eixo, inicio, fim, direcao };
    const b = blocoDoMovimento(m, eixo === "linha" ? linhas : colunas);
    if (!b) return;
    const mescladas = Object.values(folha.config?.merge ?? {}) as { r: number; c: number; rs: number; cs: number }[];
    if (mescladas.some(g => (eixo === "linha" ? g.r <= b.ate && g.r + g.rs - 1 >= b.de : g.c <= b.ate && g.c + g.cs - 1 >= b.de))) {
      setAviso("Há células mescladas nessas linhas/colunas: desfaça a mesclagem para mover.");
      return;
    }
    const ops: { op: "replace"; id?: string; path: (string | number)[]; value: unknown }[] = [];
    // 1) o bloco gira (seleção + vizinha)
    const bloco = eixo === "linha" ? dados.slice(b.de, b.ate + 1) : dados.map(l => l.slice(b.de, b.ate + 1));
    const girado = girarBloco(bloco, m, b.de);
    const novo = dados.map(l => [...l]);
    girado.forEach((l, i) => l.forEach((cel, j) => {
      const r = eixo === "linha" ? b.de + i : i, c = eixo === "linha" ? j : b.de + j;
      novo[r][c] = cel;
    }));
    // 2) fórmulas da página inteira passam a apontar para as mesmas células
    const calcChain: { r: number; c: number; id: string }[] = [];
    for (let r = 0; r < linhas; r++) {
      for (let c = 0; c < colunas; c++) {
        const cel = novo[r][c];
        if (cel && typeof cel.f === "string") {
          const f = ajustarFormula(cel.f, m);
          if (f !== cel.f) novo[r][c] = { ...cel, f };
          calcChain.push({ r, c, id: folha.id });
        }
        if (novo[r][c] !== dados[r][c]) ops.push({ op: "replace", id: folha.id, path: ["data", r, c], value: novo[r][c] ? structuredClone(novo[r][c]) : null });
      }
    }
    ops.push({ op: "replace", id: folha.id, path: ["calcChain"], value: calcChain });
    // 3) largura/altura vão junto
    const idx = Array.from({ length: b.ate - b.de + 1 }, (_, k) => b.de + k);
    const medidas = eixo === "linha" ? w.getRowHeight(idx) : w.getColumnWidth(idx);
    const girar = girarBloco([idx.map(i => medidas[i])], { ...m, eixo: "coluna" }, b.de)[0];
    // 4) a seleção acompanha. Vai junto nas operações (o editor copia o valor de cada uma); o setSelection guarda o
    // objeto recebido e quebra quando o React repete a atualização (modo de desenvolvimento).
    const linhasSel = eixo === "linha" ? [b.novoInicio, b.novoFim] : [sel.row[0], sel.row[1]];
    const colunasSel = eixo === "coluna" ? [b.novoInicio, b.novoFim] : [sel.column[0], sel.column[1]];
    ops.push({ op: "replace", path: ["luckysheet_select_save"], value: [{ row: linhasSel, column: colunasSel, row_focus: linhasSel[0], column_focus: colunasSel[0] }] });
    w.applyOp(ops);
    const novas = Object.fromEntries(idx.map((i, k) => [String(i), girar[k]]));
    if (eixo === "linha") w.setRowHeight(novas); else w.setColumnWidth(novas);
    try { w.calculateFormula(folha.id); } catch { /* fórmula inválida: a célula mostra o erro */ }
  }, []);

  // Dois cliques na borda do cabeçalho da coluna: ajusta a largura ao texto mais largo (todas as colunas selecionadas,
  // se a borda for de uma delas), como no Excel e no Google Sheets.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medidor = document.createElement("canvas").getContext("2d");
    const duplo = (e: MouseEvent) => {
      const alca = (e.target as HTMLElement | null)?.closest("#fortune-cols-change-size") as HTMLElement | null;
      const w = wb.current;
      if (!alca || !w || !medidor) return;
      const cabecalho = el.querySelector(".fortune-col-header")?.getBoundingClientRect();
      const rolagem = el.querySelector(".luckysheet-scrollbar-x")?.scrollLeft ?? 0;
      const dados = w.getSheet().data;
      if (!cabecalho || !dados?.length) return;
      const total = dados[0]?.length ?? 0;
      const idx = Array.from({ length: total }, (_, i) => i);
      const medidas = w.getColumnWidth(idx);
      const x = alca.getBoundingClientRect().left + 5 - cabecalho.left + rolagem;
      const c = colunaDaBorda(idx.map(i => medidas[i]), x);
      if (c < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const sel = w.getSelection()?.[0];
      const colunas = sel && c >= sel.column[0] && c <= sel.column[1] && sel.row[0] === 0 && sel.row[1] >= dados.length - 1
        ? Array.from({ length: sel.column[1] - sel.column[0] + 1 }, (_, k) => sel.column[0] + k) : [c];
      const novas: Record<string, number> = {};
      for (const col of colunas) {
        const textos = dados.map(l => {
          const cel = l[col];
          const bruto = cel?.m ?? cel?.v;
          return { texto: bruto === null || bruto === undefined ? "" : textoNaTela(String(bruto)), negrito: cel?.bl === 1, tamanho: Number(cel?.fs) || 10 };
        });
        const largura = larguraIdeal(textos, t => { medidor.font = `${t.negrito ? "bold " : ""}${t.tamanho ?? 10}pt Arial`; return medidor.measureText(t.texto).width; });
        if (largura) novas[String(col)] = largura;
      }
      if (Object.keys(novas).length) w.setColumnWidth(novas);
    };
    el.addEventListener("dblclick", duplo, { capture: true });
    return () => el.removeEventListener("dblclick", duplo, { capture: true });
  }, [inicial]);

  // Alt+Shift+setas move (como no Google Sheets), fora da edição de uma célula.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const tecla = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest(".luckysheet-cell-input, input, textarea") && alvo.textContent) return;
      const mapa: Record<string, [Eixo, Direcao]> = { ArrowUp: ["linha", "antes"], ArrowDown: ["linha", "depois"], ArrowLeft: ["coluna", "antes"], ArrowRight: ["coluna", "depois"] };
      const acao = mapa[e.key];
      if (!acao) return;
      e.preventDefault();
      e.stopPropagation();
      mover(...acao);
    };
    el.addEventListener("keydown", tecla, { capture: true });
    return () => el.removeEventListener("keydown", tecla, { capture: true });
  }, [inicial, mover]);

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
        {extra}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Mover linhas e colunas">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Mover</span>
          {([["linha", "antes", ArrowUp, "Mover linha para cima (Alt+Shift+↑)"], ["linha", "depois", ArrowDown, "Mover linha para baixo (Alt+Shift+↓)"],
            ["coluna", "antes", ArrowLeft, "Mover coluna para a esquerda (Alt+Shift+←)"], ["coluna", "depois", ArrowRight, "Mover coluna para a direita (Alt+Shift+→)"]] as const).map(([eixo, dir, Icone, rotulo]) => (
            <button key={rotulo} type="button" title={rotulo} aria-label={rotulo} onClick={() => mover(eixo, dir)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"><Icone className="h-3.5 w-3.5" /></button>
          ))}
        </div>
        <button type="button" className={botao} onClick={baixar}><Download className="h-3.5 w-3.5" />Baixar Excel</button>
      </div>
      {estado === "conflito" && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta planilha foi alterada em outro aparelho e o que você mudou aqui não foi salvo.
          <button type="button" className={botao} onClick={() => window.location.reload()}>Ver a versão mais nova</button>
        </p>
      )}
      {aviso && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{aviso}</p>}
      <div ref={caixa} className="planilha-bloco relative min-h-[20rem] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white" data-planilha="">
        <Workbook ref={wb} data={inicial as unknown as AbaEditor[]} lang="en" currency="R$" hooks={hooks}
          onChange={dados => { atual.current = dados as unknown as AbaFs[]; agendar(); }} />
      </div>
    </div>
  );
}
