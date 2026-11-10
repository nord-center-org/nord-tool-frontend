import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, FileUp, Loader2, MapPin, Minus, Plus, Ruler, Search, Square, Trash2, Undo2,
  X, ZoomIn, ZoomOut,
} from "lucide-react";

import VistaPdf, { type ModoMedida } from "@/react-app/components/cubicagem/VistaPdf";
import { abrirProjeto, gradeDaPagina, type ProjetoPdf } from "@/react-app/components/cubicagem/pdfCubicagem";
import { ApiError } from "@/react-app/services/apiClient";
import { cubicagemService as servico, type Cubicagem } from "@/react-app/services/CubicagemService";
import {
  ORDEM_TIPOS, ROTULO_FORMA, ROTULO_TIPO, ROTULO_TIPO_UM, acharPeca, areaDoPoligono, calibrar, comprimentoDaLinha, distancia, formatar, lerNumero,
  lerPecas, linhasDaPlanilha, metrosPorPonto, novoId, pecaDoAchado, pecaNova, totais, volumeDaPeca,
  type Achado, type FormaPeca, type GradePontos, type Peca, type Ponto, type TipoPeca,
} from "@/react-app/utils/cubicagem";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const input = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const base = "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40";
const botao = `${base} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const botaoAzul = `${base} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
const botaoEscuro = `${base} border-slate-800 bg-slate-800 text-white hover:bg-slate-700`;

type Status = "salvo" | "pendente" | "salvando" | "erro" | "conflito";
interface Medindo { idPeca: string; campo: "comp" | "area" }

/** Número em pt-BR: guarda o texto enquanto a pessoa digita e só devolve o número quando ele é válido. */
function CampoNumero({ rotulo, valor, onMudar, unidade, casas = 2, acao }: {
  rotulo: string; valor: number | null; onMudar: (v: number | null) => void; unidade: string; casas?: number; acao?: ReactNode;
}) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  const [invalido, setInvalido] = useState(false);
  const ultimo = useRef(valor);
  useEffect(() => {
    if (valor !== ultimo.current) { ultimo.current = valor; setTexto(valor == null ? "" : String(valor).replace(".", ",")); setInvalido(false); }
  }, [valor]);
  return (
    <div className="min-w-0">
      <div className="mt-0.5 flex items-end gap-1">
        <label className="relative block min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rotulo}</span>
          <input inputMode="decimal" value={texto} aria-label={rotulo} aria-invalid={invalido}
            onChange={e => {
              setTexto(e.target.value);
              const n = lerNumero(e.target.value);
              const ok = n == null || (!Number.isNaN(n) && n >= 0);
              setInvalido(!ok);
              if (ok) { ultimo.current = n == null ? null : Math.round(n * 10 ** casas) / 10 ** casas; onMudar(ultimo.current); }
            }}
            className={`${input} mt-0.5 pr-9 text-right ${invalido ? "border-red-400" : ""}`} />
          <span className="pointer-events-none absolute bottom-2 right-2 text-[11px] text-slate-400">{unidade}</span>
        </label>
        {acao}
      </div>
    </div>
  );
}

function CartaoPeca({ p, onMudar, onApagar, onDuplicar, onMedir, podeMedir, onVerNoPdf, medindoAqui }: {
  p: Peca; onMudar: (p: Peca) => void; onApagar: () => void; onDuplicar: () => void; onMedir: (campo: "comp" | "area") => void;
  podeMedir: boolean; onVerNoPdf: (() => void) | null; medindoAqui: boolean;
}) {
  const v = volumeDaPeca(p);
  const [descontosAbertos, setDescontosAbertos] = useState(p.descontos.length > 0);
  const muda = (parcial: Partial<Peca>) => onMudar({ ...p, ...parcial });
  const medir = (campo: "comp" | "area") => (
    <button type="button" onClick={() => onMedir(campo)} disabled={!podeMedir} title={podeMedir ? "Medir no desenho" : "Abra o PDF do projeto para medir no desenho"}
      aria-label={`Medir ${campo === "comp" ? "comprimento" : "área"} de ${p.codigo || "peça"} no desenho`}
      className={`h-8 w-8 shrink-0 rounded-lg border ${medindoAqui ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"} inline-flex items-center justify-center disabled:opacity-40`}>
      {campo === "comp" ? <Ruler className="h-4 w-4" /> : <Square className="h-4 w-4" />}
    </button>
  );
  return (
    <article className={`rounded-xl border bg-white p-3 ${medindoAqui ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`} aria-label={`Peça ${p.codigo || "sem código"}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-24">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Peça</span>
          <input value={p.codigo} maxLength={40} onChange={e => muda({ codigo: e.target.value.toUpperCase() })} aria-label="Código da peça" className={`${input} mt-0.5 font-bold`} />
        </label>
        <label className="min-w-[7rem] flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo</span>
          <select value={p.tipo} onChange={e => muda({ tipo: e.target.value as TipoPeca })} aria-label="Tipo da peça" className={`${input} mt-0.5`}>
            {ORDEM_TIPOS.map(t => <option key={t} value={t}>{ROTULO_TIPO_UM[t]}</option>)}
          </select>
        </label>
        <label className="min-w-[10rem] flex-[2]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cálculo</span>
          <select value={p.forma} onChange={e => muda({ forma: e.target.value as FormaPeca })} aria-label="Forma de cálculo" className={`${input} mt-0.5`}>
            {(Object.keys(ROTULO_FORMA) as FormaPeca[]).map(f => <option key={f} value={f}>{ROTULO_FORMA[f]}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {p.forma === "RET" && <>
          <CampoNumero rotulo="Largura b" unidade="cm" casas={1} valor={p.b} onMudar={b => muda({ b })} />
          <CampoNumero rotulo="Altura h" unidade="cm" casas={1} valor={p.h} onMudar={h => muda({ h })} />
        </>}
        {p.forma === "CIRC" && <CampoNumero rotulo="Diâmetro" unidade="cm" casas={1} valor={p.d} onMudar={d => muda({ d })} />}
        {(p.forma === "RET" || p.forma === "CIRC") && <CampoNumero rotulo="Comprimento" unidade="m" valor={p.comp} onMudar={comp => muda({ comp })} acao={medir("comp")} />}
        {p.forma === "AREA" && <>
          <CampoNumero rotulo="Área" unidade="m²" valor={p.area} onMudar={area => muda({ area })} acao={medir("area")} />
          <CampoNumero rotulo="Espessura" unidade="cm" casas={1} valor={p.esp} onMudar={esp => muda({ esp })} />
        </>}
        {p.forma === "VOLUME" && <CampoNumero rotulo="Volume" unidade="m³" casas={3} valor={p.vol} onMudar={vol => muda({ vol })} />}
        <CampoNumero rotulo="Quantidade" unidade="un" casas={0} valor={p.qtd} onMudar={q => muda({ qtd: Math.max(1, Math.min(9999, q ?? 1)) })} />
      </div>

      {descontosAbertos && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Descontos (m³, já para todas as unidades)</p>
          {p.descontos.map((d, i) => (
            <div key={d.id} className="flex items-end gap-1.5">
              <input value={d.desc} maxLength={120} placeholder="Ex.: trecho dentro do P5" aria-label={`Descrição do desconto ${i + 1}`}
                onChange={e => muda({ descontos: p.descontos.map(x => x.id === d.id ? { ...x, desc: e.target.value } : x) })} className={`${input} flex-1`} />
              <div className="w-28"><CampoNumero rotulo={`Desconto ${i + 1}`} unidade="m³" casas={4} valor={d.m3}
                onMudar={m3 => muda({ descontos: p.descontos.map(x => x.id === d.id ? { ...x, m3 } : x) })} /></div>
              <button type="button" aria-label={`Tirar desconto ${i + 1}`} onClick={() => muda({ descontos: p.descontos.filter(x => x.id !== d.id) })}
                className="mb-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" className={botao} onClick={() => muda({ descontos: [...p.descontos, { id: novoId(), desc: "", m3: null }] })}><Plus className="h-3.5 w-3.5" />Desconto</button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="mr-auto text-sm" aria-live="polite">
          {v.liquido == null
            ? <span className="text-amber-700">Falta {v.falta.join(", ")}</span>
            : <span className="text-slate-600">
              <b className="text-base text-slate-900">{formatar(v.liquido)} m³</b>
              {(p.qtd > 1 || v.descontos > 0) && <span className="ml-1 text-xs text-slate-400">({p.qtd > 1 ? `${p.qtd} × ${formatar(v.unitario)}` : formatar(v.bruto)}{v.descontos > 0 ? ` − ${formatar(v.descontos, 4)}` : ""})</span>}
            </span>}
        </div>
        {onVerNoPdf && <button type="button" className={botao} onClick={onVerNoPdf} title="Ver no projeto"><MapPin className="h-3.5 w-3.5" />Pág. {p.origem?.pagina}</button>}
        {!descontosAbertos && <button type="button" className={botao} onClick={() => { setDescontosAbertos(true); if (!p.descontos.length) muda({ descontos: [{ id: novoId(), desc: "", m3: null }] }); }}><Minus className="h-3.5 w-3.5" />Descontar</button>}
        <button type="button" className={botao} onClick={onDuplicar} aria-label={`Duplicar ${p.codigo || "peça"}`}><Copy className="h-3.5 w-3.5" /></button>
        <button type="button" className={`${base} border-slate-200 bg-white text-red-600 hover:bg-red-50`} onClick={onApagar} aria-label={`Apagar ${p.codigo || "peça"}`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </article>
  );
}

/**
 * Cubicagem aberta: o PDF do projeto (só no aparelho) à esquerda, com busca da peça pelo código e medida no desenho;
 * à direita as peças, os totais por tipo, a perda e a planilha. Salva sozinha (com versão, como o bloco de notas).
 */
export default function EditorCubicagem({ id, onVoltar }: { id: number; onVoltar: () => void }) {
  const [cub, setCub] = useState<Cubicagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [perda, setPerda] = useState<number | null>(0);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [status, setStatus] = useState<Status>("salvo");
  const versao = useRef(1);
  const mudou = useRef(false);

  const [projeto, setProjeto] = useState<ProjetoPdf | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [escala, setEscala] = useState<number | null>(null);
  const [fator, setFator] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoMedida>("nada");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [medindo, setMedindo] = useState<Medindo | null>(null);
  const [cota, setCota] = useState("");
  const [avisoMedida, setAvisoMedida] = useState<string | null>(null);
  const [ima, setIma] = useState(true);
  const [grade, setGrade] = useState<GradePontos | null>(null);

  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [destaque, setDestaque] = useState<Achado | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    servico.abrir(id).then(c => {
      if (!vivo) return;
      setCub(c); setTitulo(c.nmTitulo); setPerda(Number(c.nrPerda) || 0); setPecas(lerPecas(c.pecas)); versao.current = c.nrVersao;
    }).catch(e => vivo && setErro(mensagem(e, "Não deu para abrir a cubicagem.")));
    return () => { vivo = false; };
  }, [id]);

  const alterar = useCallback((f: (ps: Peca[]) => Peca[]) => { mudou.current = true; setStatus("pendente"); setPecas(f); }, []);

  // Salva 1 s depois da última mudança.
  useEffect(() => {
    if (!cub || !mudou.current || status === "conflito") return;
    const t = window.setTimeout(async () => {
      mudou.current = false;
      setStatus("salvando");
      try {
        const salvo = await servico.salvar(id, titulo.trim() || cub.nmTitulo, perda ?? 0, pecas, versao.current);
        versao.current = salvo.nrVersao;
        setStatus(mudou.current ? "pendente" : "salvo");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setStatus("conflito");
        else { mudou.current = true; setStatus("erro"); }
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [pecas, titulo, perda, cub, id, status]);

  // Vértices do desenho da página, para o ímã (lidos só quando alguém vai medir).
  useEffect(() => {
    if (!projeto || modo === "nada") return;
    let vivo = true;
    void gradeDaPagina(projeto.doc, pagina).then(g => vivo && setGrade(g));
    return () => { vivo = false; setGrade(null); };
  }, [projeto, pagina, modo]);

  // A escala da folha muda com a página (a não ser que a pessoa tenha calibrado).
  useEffect(() => { if (projeto) setEscala(projeto.escalas[pagina - 1] ?? projeto.escalas.find(e => e != null) ?? null); }, [projeto, pagina]);

  const abrirPdf = async (f: File) => {
    setAbrindo("Abrindo o PDF…");
    setAvisoMedida(null);
    try {
      const p = await abrirProjeto(f, (n, total) => setAbrindo(`Lendo o texto: página ${n} de ${total}…`));
      projeto?.doc.destroy().catch(() => undefined);
      setProjeto(p); setPagina(1); setZoom(1); setFator(null); setAchados(null); setDestaque(null);
      if (!p.linhas.length) setAvisoMedida("Esse PDF não tem texto (o desenho virou só linhas): a busca pelo código não acha nada, mas dá para medir no desenho.");
    } catch (e) {
      setAvisoMedida(mensagem(e, "Não deu para abrir o PDF."));
    } finally {
      setAbrindo(null);
    }
  };

  const buscar = () => {
    const c = busca.trim();
    if (!c) return;
    if (!projeto) { setAchados([]); return; }
    const r = acharPeca(c, projeto.linhas);
    setAchados(r);
    if (r[0]) irPara(r[0]);
  };

  const irPara = (a: Achado) => {
    setDestaque(a);
    setPagina(a.pagina);
    // Leva o destaque para o meio da área de rolagem depois que a página for desenhada.
    window.setTimeout(() => {
      const svg = rolagem.current?.querySelector("svg rect");
      svg?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }, 600);
  };

  const adicionar = (p: Peca) => {
    alterar(ps => [...ps, p]);
    window.setTimeout(() => document.querySelector(`[data-peca="${p.id}"] input[aria-label="Comprimento"], [data-peca="${p.id}"] input[aria-label="Área"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  };

  // ---------- medida no desenho ----------
  const fatorAtual = fator ?? (escala ? metrosPorPonto(escala) : null);
  const valorMedido = modo === "linha" ? comprimentoDaLinha(pontos) * (fatorAtual ?? 0)
    : modo === "area" ? areaDoPoligono(pontos) * (fatorAtual ?? 0) ** 2 : 0;

  const comecarMedida = (m: Medindo) => {
    if (!projeto) return;
    setMedindo(m); setPontos([]); setModo(m.campo === "comp" ? "linha" : "area"); setAvisoMedida(null);
    rolagem.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const cancelarMedida = () => { setModo("nada"); setPontos([]); setMedindo(null); setCota(""); };
  const concluirMedida = () => {
    if (modo === "calibrar") {
      const m = lerNumero(cota);
      const f = pontos.length === 2 && m != null && !Number.isNaN(m) ? calibrar(distancia(pontos[0], pontos[1]), m) : null;
      if (!f) { setAvisoMedida("Toque nas duas pontas da cota e escreva quantos metros ela mede."); return; }
      setFator(f);
      setAvisoMedida(`Calibrado: a medida no desenho segue essa cota (${formatar(m, 2)} m).`);
      cancelarMedida();
      return;
    }
    if (!medindo) return cancelarMedida();
    if (!fatorAtual) { setAvisoMedida("Informe a escala da folha (ex.: 50 para 1:50) ou calibre por uma cota antes de medir."); return; }
    const precisa = modo === "area" ? 3 : 2;
    if (pontos.length < precisa) { setAvisoMedida(modo === "area" ? "Toque em pelo menos 3 cantos da área." : "Toque no começo e no fim da peça."); return; }
    const valor = Math.round(valorMedido * 100) / 100;
    alterar(ps => ps.map(p => p.id === medindo.idPeca ? { ...p, [medindo.campo]: valor } : p));
    cancelarMedida();
  };

  const t = useMemo(() => totais(pecas, perda ?? 0), [pecas, perda]);
  const grupos = useMemo(() => ORDEM_TIPOS.map(tipo => ({ tipo, lista: pecas.filter(p => p.tipo === tipo) })).filter(g => g.lista.length), [pecas]);

  const baixarPlanilha = () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(linhasDaPlanilha(pecas, perda ?? 0)), "Cubicagem");
    const nome = (titulo.trim() || "cubicagem").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60);
    XLSX.writeFile(livro, `Cubicagem-${nome}.xlsx`);
  };

  if (erro) return <div className="p-6"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p><button type="button" className={`${botao} mt-3`} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Voltar</button></div>;
  if (!cub) return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</div>;

  const rotuloStatus: Record<Status, ReactNode> = {
    salvo: <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" />Salvo</span>,
    pendente: <span className="text-slate-400">Alterado…</span>,
    salvando: <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando</span>,
    erro: <span className="text-red-600">Não salvou, tentando de novo…</span>,
    conflito: <span className="text-red-600">Mudou em outro aparelho</span>,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Cubicagens</button>
        <input value={titulo} maxLength={120} aria-label="Nome da cubicagem" onChange={e => { mudou.current = true; setStatus("pendente"); setTitulo(e.target.value); }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none" />
        <span className="text-xs font-bold" aria-live="polite">{rotuloStatus[status]}</span>
      </div>
      {status === "conflito" && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta cubicagem foi alterada em outro aparelho e o que você mudou aqui não foi salvo.
          <button type="button" className={botao} onClick={() => window.location.reload()}>Ver a versão mais nova</button>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
        {/* Projeto em PDF */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white" aria-label="Projeto em PDF">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
            <input ref={arquivo} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Arquivo do projeto"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void abrirPdf(f); }} />
            <button type="button" className={botaoAzul} onClick={() => arquivo.current?.click()} disabled={!!abrindo}>
              <FileUp className="h-4 w-4" />{projeto ? "Trocar PDF" : "Abrir PDF do projeto"}
            </button>
            {projeto && <>
              <span className="max-w-[10rem] truncate text-xs text-slate-500" title={projeto.nome}>{projeto.nome}</span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" className={botao} aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
                <span className="px-1 text-xs font-bold text-slate-600">{pagina}/{projeto.paginas}</span>
                <button type="button" className={botao} aria-label="Próxima página" disabled={pagina >= projeto.paginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="h-4 w-4" /></button>
                <button type="button" className={botao} aria-label="Diminuir zoom" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, z / 1.25))}><ZoomOut className="h-4 w-4" /></button>
                <span className="w-10 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
                <button type="button" className={botao} aria-label="Aumentar zoom" disabled={zoom >= 6} onClick={() => setZoom(z => Math.min(6, z * 1.25))}><ZoomIn className="h-4 w-4" /></button>
              </div>
            </>}
          </div>
          {projeto && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-xs text-slate-600">
              <label className="inline-flex items-center gap-1">Escala 1:
                <input inputMode="numeric" aria-label="Escala da folha" value={escala ?? ""} disabled={fator != null}
                  onChange={e => { const n = Number(e.target.value.replace(/\D/g, "")); setEscala(n > 0 ? Math.min(5000, n) : null); }}
                  className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5 text-right disabled:bg-slate-100" />
              </label>
              {fator != null
                ? <button type="button" className={botao} onClick={() => { setFator(null); setAvisoMedida(null); }}>Calibrado · usar a escala</button>
                : <button type="button" className={botao} disabled={modo !== "nada"} onClick={() => { setModo("calibrar"); setPontos([]); setMedindo(null); setAvisoMedida(null); }}>
                  <Ruler className="h-3.5 w-3.5" />Calibrar por uma cota</button>}
              <label className="inline-flex items-center gap-1" title="Encaixa o toque nos cantos e pontas das linhas do desenho">
                <input type="checkbox" checked={ima} onChange={e => setIma(e.target.checked)} />Ímã nos cantos
              </label>
              {!escala && fator == null && <span className="text-amber-700">Sem escala achada na folha: informe ou calibre.</span>}
            </div>
          )}
          {modo !== "nada" && (
            <div className="sticky top-[4.5rem] z-10 flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 shadow-sm lg:top-0 px-2 py-1.5 text-xs text-blue-900" role="status">
              <span className="font-bold">
                {modo === "calibrar" ? "Toque nas duas pontas de uma cota conhecida"
                  : modo === "linha" ? "Toque no começo e no fim da peça (pode seguir por vários pontos)" : "Toque nos cantos da área"}
              </span>
              {modo !== "calibrar" && pontos.length > 1 && fatorAtual && <b className="rounded bg-white px-1.5 py-0.5">{formatar(valorMedido, 2)} {modo === "area" ? "m²" : "m"}</b>}
              {modo === "calibrar" && pontos.length === 2 && (
                <label className="inline-flex items-center gap-1">Mede
                  <input autoFocus inputMode="decimal" aria-label="Medida real da cota" value={cota} onChange={e => setCota(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") concluirMedida(); }} className="w-20 rounded-md border border-blue-200 px-1.5 py-0.5 text-right" /> m
                </label>
              )}
              <div className="ml-auto flex gap-1">
                <button type="button" className={botao} disabled={!pontos.length} onClick={() => setPontos(p => p.slice(0, -1))}><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
                <button type="button" className={botao} onClick={cancelarMedida}>Cancelar</button>
                <button type="button" className={botaoAzul} onClick={concluirMedida}><Check className="h-3.5 w-3.5" />Concluir</button>
              </div>
            </div>
          )}
          {avisoMedida && <p role="alert" className="m-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{avisoMedida}</p>}
          <div ref={rolagem} className="max-h-[60vh] min-h-[14rem] overflow-auto bg-slate-100 p-2 lg:h-[calc(100vh-15rem)] lg:max-h-none">
            {abrindo && <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{abrindo}</p>}
            {!projeto && !abrindo && (
              <button type="button" onClick={() => arquivo.current?.click()}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void abrirPdf(f); }}
                className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 hover:bg-white">
                <FileUp className="h-8 w-8 text-slate-400" />
                <span><b className="text-slate-700">Abra o PDF do projeto</b> (forma, estrutura) para achar as peças pelo código e medir no desenho.</span>
                <span className="text-xs">O PDF fica só neste aparelho; o que é salvo são as peças e as medidas.</span>
              </button>
            )}
            {projeto && (
              <VistaPdf projeto={projeto} pagina={pagina} zoom={zoom} modo={modo} pontos={pontos}
                onPonto={p => setPontos(ps => (modo === "calibrar" && ps.length >= 2 ? [p] : [...ps, p]))}
                destaque={destaque && destaque.pagina === pagina ? destaque.caixa : null} grade={ima ? grade : null} />
            )}
          </div>
        </section>

        {/* Peças e totais */}
        <div className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="Buscar peça">
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); buscar(); }}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Código da peça: V12, P5, L3…" aria-label="Código da peça para buscar"
                  className={`${input} pl-8`} />
              </div>
              <button type="submit" className={botaoEscuro}>Buscar</button>
            </form>
            {achados && (
              <div className="mt-2 space-y-1.5">
                {!projeto && <p className="text-xs text-slate-500">Abra o PDF do projeto para buscar; ou adicione a peça e digite as medidas.</p>}
                {projeto && !achados.length && <p className="text-xs text-slate-500">Não achei <b>{busca.trim().toUpperCase()}</b> no texto do PDF. Adicione e digite as medidas, ou meça no desenho.</p>}
                {achados.slice(0, 6).map((a, i) => (
                  <div key={`${a.pagina}-${i}`} className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs ${destaque === a ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => irPara(a)} title="Mostrar no projeto">
                      <b className="text-slate-800">{a.codigo}</b>
                      <span className="ml-1 text-slate-500">pág. {a.pagina} · “{a.trecho}”</span>
                      <span className="block font-bold text-slate-700">
                        {a.b != null ? `Seção ${formatar(a.b, 0)} × ${formatar(a.h, 0)} cm` : a.d != null ? `Ø ${formatar(a.d, 0)} cm` : a.esp != null ? `Espessura ${formatar(a.esp, 0)} cm` : "Sem medida no texto"}
                      </span>
                    </button>
                    <button type="button" className={botao} onClick={() => adicionar(pecaDoAchado(a, projeto?.nome ?? ""))}><Plus className="h-3.5 w-3.5" />Adicionar</button>
                  </div>
                ))}
                <button type="button" className={botao} onClick={() => adicionar(pecaNova(busca.trim().toUpperCase()))}><Plus className="h-3.5 w-3.5" />Adicionar {busca.trim().toUpperCase() || "peça"} e digitar as medidas</button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="Totais">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total com perda</p>
                <p className="text-2xl font-bold text-slate-900" aria-label="Total com perda">{formatar(t.comPerda)} m³</p>
              </div>
              <div className="w-28"><CampoNumero rotulo="Perda" unidade="%" casas={1} valor={perda}
                onMudar={v => { mudou.current = true; setStatus("pendente"); setPerda(v == null ? 0 : Math.min(50, v)); }} /></div>
            </div>
            {t.porTipo.length > 0 && (
              <table className="mt-2 w-full text-xs">
                <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-1">Tipo</th><th className="py-1 text-right">Peças</th><th className="py-1 text-right">Descontos</th><th className="py-1 text-right">Volume</th></tr></thead>
                <tbody>
                  {t.porTipo.map(x => (
                    <tr key={x.tipo} className="border-t border-slate-100">
                      <td className="py-1 font-bold text-slate-700">{ROTULO_TIPO[x.tipo]}{x.incompletas > 0 && <span className="ml-1 font-normal text-amber-700">({x.incompletas} sem medida)</span>}</td>
                      <td className="py-1 text-right">{x.pecas}</td>
                      <td className="py-1 text-right">{x.descontos ? `− ${formatar(x.descontos)}` : "—"}</td>
                      <td className="py-1 text-right font-bold">{formatar(x.liquido)} m³</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200"><td className="py-1 font-bold">Total</td><td /><td className="py-1 text-right">{t.descontos ? `− ${formatar(t.descontos)}` : "—"}</td><td className="py-1 text-right font-bold">{formatar(t.liquido)} m³</td></tr>
                  <tr><td className="py-1 text-slate-500">Perda ({formatar(perda ?? 0, 1)}%)</td><td /><td /><td className="py-1 text-right text-slate-500">+ {formatar(t.perda)} m³</td></tr>
                </tbody>
              </table>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={botao} onClick={() => adicionar(pecaNova())}><Plus className="h-3.5 w-3.5" />Peça sem código</button>
              <button type="button" className={botao} onClick={baixarPlanilha} disabled={!pecas.length}><Download className="h-3.5 w-3.5" />Baixar planilha</button>
            </div>
          </section>

          {!pecas.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Busque uma peça pelo código ou adicione uma para começar.</p>}
          {grupos.map(g => (
            <section key={g.tipo} aria-label={ROTULO_TIPO[g.tipo]} className="space-y-2">
              <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{ROTULO_TIPO[g.tipo]} · {formatar(t.porTipo.find(x => x.tipo === g.tipo)?.liquido ?? 0)} m³</h3>
              {g.lista.map(p => (
                <div key={p.id} data-peca={p.id}>
                  <CartaoPeca p={p} podeMedir={!!projeto && modo === "nada"} medindoAqui={medindo?.idPeca === p.id}
                    onMudar={n => alterar(ps => ps.map(x => x.id === p.id ? n : x))}
                    onApagar={() => alterar(ps => ps.filter(x => x.id !== p.id))}
                    onDuplicar={() => alterar(ps => { const i = ps.findIndex(x => x.id === p.id); const c = { ...p, id: novoId(), descontos: p.descontos.map(d => ({ ...d, id: novoId() })) }; return [...ps.slice(0, i + 1), c, ...ps.slice(i + 1)]; })}
                    onMedir={campo => comecarMedida({ idPeca: p.id, campo })}
                    onVerNoPdf={projeto && p.origem && p.origem.pagina <= projeto.paginas ? () => {
                      const a = acharPeca(p.codigo, projeto.linhas).find(x => x.pagina === p.origem?.pagina);
                      if (a) irPara(a); else setPagina(p.origem?.pagina ?? 1);
                    } : null} />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
