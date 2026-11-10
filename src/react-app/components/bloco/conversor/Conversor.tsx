import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Combine, Download, FileImage, FileSpreadsheet, FileText, Hash, ImageIcon, Images, LayoutGrid, Loader2,
  Minimize2, NotebookPen, RotateCcw, RotateCw, Scissors, Stamp, Trash2, Upload, X, type LucideIcon,
} from "lucide-react";

import {
  NIVEIS_COMPRESSAO, comprimirPdf, converterImagem, excelParaPdf, lerImagem, miniaturas, pdfParaImagens, wordParaPdf, zipar, type NivelCompressao,
} from "@/react-app/components/bloco/conversor/ferramentasNavegador";
import { baixarArquivo } from "@/react-app/utils/baixarArquivo";
import {
  contarPaginas, extrairPaginas, imagensParaPdf, juntarPdfs, lerIntervalos, marcaDagua, nomeResultado, numerarPaginas, organizarPdf, tamanhoLegivel,
  type PaginaOrganizada, type PosicaoNumero,
} from "@/react-app/utils/conversor";

type IdFerramenta = "juntar" | "dividir" | "organizar" | "imagens-pdf" | "word-pdf" | "excel-pdf" | "pdf-imagens" | "comprimir" | "numerar" | "marca" | "imagem-formato";

interface Ferramenta { id: IdFerramenta; titulo: string; texto: string; icone: LucideIcon; cor: string; grupo: string; aceita: string; varios: boolean }

const PDF = ".pdf,application/pdf";
const IMAGENS = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif";
const FERRAMENTAS: Ferramenta[] = [
  { id: "juntar", titulo: "Juntar PDF", texto: "Vários PDFs num só, na ordem que você quiser", icone: Combine, cor: "#dc2626", grupo: "Organizar PDF", aceita: PDF, varios: true },
  { id: "dividir", titulo: "Dividir PDF", texto: "Separar páginas ou cada página num arquivo", icone: Scissors, cor: "#dc2626", grupo: "Organizar PDF", aceita: PDF, varios: false },
  { id: "organizar", titulo: "Organizar páginas", texto: "Girar, tirar e mudar a ordem das páginas", icone: LayoutGrid, cor: "#dc2626", grupo: "Organizar PDF", aceita: PDF, varios: false },
  { id: "imagens-pdf", titulo: "Imagem para PDF", texto: "Fotos e prints viram páginas de um PDF", icone: FileImage, cor: "#ca8a04", grupo: "Converter para PDF", aceita: IMAGENS, varios: true },
  { id: "word-pdf", titulo: "Word para PDF", texto: "Documento .docx em PDF", icone: FileText, cor: "#2563eb", grupo: "Converter para PDF", aceita: ".docx", varios: false },
  { id: "excel-pdf", titulo: "Excel para PDF", texto: "Planilha .xlsx, .xls ou .csv em PDF", icone: FileSpreadsheet, cor: "#16a34a", grupo: "Converter para PDF", aceita: ".xlsx,.xls,.ods,.csv", varios: false },
  { id: "pdf-imagens", titulo: "PDF para imagem", texto: "Cada página vira JPG ou PNG", icone: Images, cor: "#ca8a04", grupo: "Converter de PDF", aceita: PDF, varios: false },
  { id: "comprimir", titulo: "Comprimir PDF", texto: "Diminuir o tamanho do arquivo", icone: Minimize2, cor: "#059669", grupo: "Otimizar e editar", aceita: PDF, varios: false },
  { id: "numerar", titulo: "Numerar páginas", texto: "Número no rodapé ou no topo de cada página", icone: Hash, cor: "#7c3aed", grupo: "Otimizar e editar", aceita: PDF, varios: false },
  { id: "marca", titulo: "Marca d'água", texto: "Texto em diagonal em todas as páginas", icone: Stamp, cor: "#7c3aed", grupo: "Otimizar e editar", aceita: PDF, varios: false },
  { id: "imagem-formato", titulo: "Converter imagem", texto: "JPG, PNG ou WebP", icone: ImageIcon, cor: "#0891b2", grupo: "Imagens", aceita: IMAGENS, varios: true },
];
const GRUPOS = [...new Set(FERRAMENTAS.map(f => f.grupo))];

interface Resultado { arquivo: File; antes?: number; pdf: boolean }

const botao = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const botaoPrincipal = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
const campo = "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const bytesDe = async (f: File) => new Uint8Array(await f.arrayBuffer());

/**
 * Conversor de arquivos do bloco de notas, no estilo do ILovePDF: escolhe a ferramenta, solta os arquivos, ajusta e
 * baixa o resultado (PDF de resultado também pode virar um caderno). Tudo acontece no aparelho.
 */
export default function Conversor({ onVoltar, onAbrirNoCaderno }: { onVoltar: () => void; onAbrirNoCaderno: (arquivo: File) => void }) {
  const [id, setId] = useState<IdFerramenta | null>(null);
  const ferramenta = FERRAMENTAS.find(f => f.id === id) ?? null;
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [paginasPdf, setPaginasPdf] = useState<number | null>(null);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  // Opções das ferramentas.
  const [intervalo, setIntervalo] = useState("");
  const [modoDividir, setModoDividir] = useState<"intervalo" | "cada">("intervalo");
  const [modoImagem, setModoImagem] = useState<"a4" | "original">("a4");
  const [formatoImg, setFormatoImg] = useState<"jpg" | "png">("jpg");
  const [dpi, setDpi] = useState(150);
  const [nivel, setNivel] = useState<NivelCompressao>("media");
  const [posicao, setPosicao] = useState<PosicaoNumero>("rodape-centro");
  const [formatoNumero, setFormatoNumero] = useState<"n" | "n-de-t" | "pagina-n">("n-de-t");
  const [inicio, setInicio] = useState(1);
  const [textoMarca, setTextoMarca] = useState("CONFIDENCIAL");
  const [formatoConv, setFormatoConv] = useState<"jpg" | "png" | "webp">("jpg");
  const [ordem, setOrdem] = useState<PaginaOrganizada[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);

  const limpar = () => { setArquivos([]); setResultado(null); setErro(null); setPaginasPdf(null); setOrdem([]); setIntervalo(""); };
  const escolher = (f: IdFerramenta | null) => { limpar(); setId(f); };

  // Quantas páginas o PDF tem (dividir, PDF para imagem) e as miniaturas (organizar).
  useEffect(() => {
    const unico = ferramenta && !ferramenta.varios && ferramenta.aceita === PDF ? arquivos[0] : null;
    if (!unico) return;
    let vivo = true;
    void (async () => {
      try {
        const b = await bytesDe(unico);
        const n = await contarPaginas(b);
        if (!vivo) return;
        setPaginasPdf(n);
        if (id === "organizar") {
          setOrdem(Array.from({ length: n }, (_, i) => ({ pagina: i + 1, giro: 0 })));
          setTrabalhando("Preparando as páginas…");
          const urls = await miniaturas(b, 140, (f, t) => vivo && setTrabalhando(`Preparando as páginas: ${f} de ${t}…`));
          if (vivo) setFotos(urls); else urls.forEach(u => URL.revokeObjectURL(u));
          setTrabalhando(null);
        }
      } catch (e) {
        if (vivo) { setErro(mensagem(e, "Não deu para abrir o PDF (pode estar com senha ou corrompido).")); setTrabalhando(null); }
      }
    })();
    return () => { vivo = false; };
  }, [arquivos, ferramenta, id]);
  useEffect(() => () => fotos.forEach(u => URL.revokeObjectURL(u)), [fotos]);

  const adicionar = (lista: FileList | File[]) => {
    if (!ferramenta) return;
    const aceitos = [...lista].filter(f => aceita(ferramenta, f));
    setErro(aceitos.length < [...lista].length ? `Alguns arquivos não são do tipo certo para “${ferramenta.titulo}” e ficaram de fora.` : null);
    if (!aceitos.length) return;
    setResultado(null);
    setFotos([]);
    setArquivos(atuais => (ferramenta.varios ? [...atuais, ...aceitos].slice(0, 100) : [aceitos[0]]));
  };
  const mover = (i: number, d: number) => setArquivos(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const progresso = (texto: string) => (f: number, t: number) => setTrabalhando(`${texto}: ${f} de ${t}…`);

  const executar = async () => {
    if (!ferramenta || !arquivos.length) return;
    setErro(null); setResultado(null);
    setTrabalhando("Trabalhando…");
    const primeiro = arquivos[0];
    const pdfFile = (bytes: Uint8Array, sufixo: string, nome = primeiro.name) => new File([bytes as BlobPart], nomeResultado(nome, sufixo, "pdf"), { type: "application/pdf" });
    try {
      let r: Resultado;
      switch (ferramenta.id) {
        case "juntar": {
          if (arquivos.length < 2) throw new Error("Escolha pelo menos dois PDFs para juntar.");
          r = { arquivo: pdfFile(await juntarPdfs(await Promise.all(arquivos.map(bytesDe))), "junto"), pdf: true };
          break;
        }
        case "dividir": {
          const b = await bytesDe(primeiro);
          const lidas = lerIntervalos(intervalo, paginasPdf ?? (await contarPaginas(b)));
          if ("erro" in lidas) throw new Error(lidas.erro);
          if (modoDividir === "intervalo") r = { arquivo: pdfFile(await extrairPaginas(b, lidas.paginas), "paginas"), pdf: true };
          else {
            const partes = [];
            for (const [i, n] of lidas.paginas.entries()) {
              partes.push({ nome: nomeResultado(primeiro.name, `pagina-${n}`, "pdf"), blob: new Blob([await extrairPaginas(b, [n]) as BlobPart], { type: "application/pdf" }) });
              setTrabalhando(`Separando: ${i + 1} de ${lidas.paginas.length}…`);
            }
            r = { arquivo: new File([await zipar(partes)], nomeResultado(primeiro.name, "paginas", "zip"), { type: "application/zip" }), pdf: false };
          }
          break;
        }
        case "organizar": {
          if (!ordem.length) throw new Error("Deixe pelo menos uma página.");
          r = { arquivo: pdfFile(await organizarPdf(await bytesDe(primeiro), ordem), "organizado"), pdf: true };
          break;
        }
        case "imagens-pdf": {
          const imgs = [];
          for (const [i, f] of arquivos.entries()) { imgs.push(await lerImagem(f)); setTrabalhando(`Lendo as imagens: ${i + 1} de ${arquivos.length}…`); }
          r = { arquivo: pdfFile(await imagensParaPdf(imgs, modoImagem), "", arquivos.length > 1 ? "imagens" : primeiro.name), pdf: true };
          break;
        }
        case "word-pdf": r = { arquivo: pdfFile(await wordParaPdf(primeiro), ""), pdf: true }; break;
        case "excel-pdf": r = { arquivo: pdfFile(await excelParaPdf(primeiro), ""), pdf: true }; break;
        case "pdf-imagens": {
          const b = await bytesDe(primeiro);
          const lidas = lerIntervalos(intervalo, paginasPdf ?? (await contarPaginas(b)));
          if ("erro" in lidas) throw new Error(lidas.erro);
          const imgs = await pdfParaImagens(b, formatoImg, dpi, lidas.paginas, progresso("Gerando as imagens"));
          r = imgs.length === 1
            ? { arquivo: new File([imgs[0].blob], nomeResultado(primeiro.name, `pagina-${lidas.paginas[0]}`, formatoImg), { type: imgs[0].blob.type }), pdf: false }
            : { arquivo: new File([await zipar(imgs)], nomeResultado(primeiro.name, "imagens", "zip"), { type: "application/zip" }), pdf: false };
          break;
        }
        case "comprimir": {
          const b = await bytesDe(primeiro);
          const menor = await comprimirPdf(b, nivel, progresso("Comprimindo as páginas"));
          // Se não diminuiu (PDF de texto e linhas já é enxuto), fica o original.
          r = { arquivo: pdfFile(menor.length < b.length ? menor : b, "comprimido"), antes: b.length, pdf: true };
          break;
        }
        case "numerar": r = { arquivo: pdfFile(await numerarPaginas(await bytesDe(primeiro), { posicao, inicio: Math.max(1, inicio || 1), formato: formatoNumero }), "numerado"), pdf: true }; break;
        case "marca": r = { arquivo: pdfFile(await marcaDagua(await bytesDe(primeiro), textoMarca.trim() || "CONFIDENCIAL"), "marca-dagua"), pdf: true }; break;
        case "imagem-formato": {
          const saida = [];
          for (const [i, f] of arquivos.entries()) {
            saida.push({ nome: nomeResultado(f.name, "", formatoConv), blob: await converterImagem(f, formatoConv) });
            setTrabalhando(`Convertendo: ${i + 1} de ${arquivos.length}…`);
          }
          r = saida.length === 1
            ? { arquivo: new File([saida[0].blob], saida[0].nome, { type: saida[0].blob.type }), pdf: false }
            : { arquivo: new File([await zipar(saida)], "imagens-convertidas.zip", { type: "application/zip" }), pdf: false };
          break;
        }
      }
      setResultado(r);
    } catch (e) {
      setErro(mensagem(e, "Não deu para converter."));
    } finally {
      setTrabalhando(null);
    }
  };

  const opcoes = useMemo(() => {
    if (!ferramenta) return null;
    const rotulo = "text-[10px] font-bold uppercase tracking-wide text-slate-400";
    const radio = <T extends string>(valor: T, atual: T, set: (v: T) => void, texto: string) => (
      <button key={valor} type="button" role="radio" aria-checked={valor === atual} onClick={() => set(valor)}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${valor === atual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{texto}</button>
    );
    const grupo = (aria: string, filhos: React.ReactNode) => <div role="radiogroup" aria-label={aria} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{filhos}</div>;
    const paginas = (
      <label className="flex flex-col gap-1"><span className={rotulo}>Páginas {paginasPdf ? `(o PDF tem ${paginasPdf})` : ""}</span>
        <input value={intervalo} onChange={e => setIntervalo(e.target.value)} placeholder="Todas, ou ex.: 1-3, 5, 8-" aria-label="Páginas" className={campo} /></label>
    );
    switch (ferramenta.id) {
      case "dividir": return <>{grupo("Como dividir", <>{radio("intervalo", modoDividir, setModoDividir, "Um PDF com as páginas")}{radio("cada", modoDividir, setModoDividir, "Cada página num PDF (.zip)")}</>)}{paginas}</>;
      case "imagens-pdf": return grupo("Tamanho da página", <>{radio("a4", modoImagem, setModoImagem, "Folha A4")}{radio("original", modoImagem, setModoImagem, "Tamanho da imagem")}</>);
      case "pdf-imagens": return <>{grupo("Formato", <>{radio("jpg", formatoImg, setFormatoImg, "JPG")}{radio("png", formatoImg, setFormatoImg, "PNG")}</>)}
        <label className="flex flex-col gap-1"><span className={rotulo}>Qualidade</span>
          <select value={dpi} onChange={e => setDpi(Number(e.target.value))} aria-label="Qualidade" className={campo}>
            <option value={96}>Tela (96 dpi)</option><option value={150}>Boa (150 dpi)</option><option value={300}>Impressão (300 dpi)</option>
          </select></label>{paginas}</>;
      case "comprimir": return grupo("Compressão", (Object.keys(NIVEIS_COMPRESSAO) as NivelCompressao[]).map(n => radio(n, nivel, setNivel, NIVEIS_COMPRESSAO[n].rotulo)));
      case "numerar": return <>
        <label className="flex flex-col gap-1"><span className={rotulo}>Onde</span>
          <select value={posicao} onChange={e => setPosicao(e.target.value as PosicaoNumero)} aria-label="Onde fica o número" className={campo}>
            <option value="rodape-centro">Rodapé, no meio</option><option value="rodape-direita">Rodapé, à direita</option><option value="topo-direita">Topo, à direita</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className={rotulo}>Formato</span>
          <select value={formatoNumero} onChange={e => setFormatoNumero(e.target.value as typeof formatoNumero)} aria-label="Formato do número" className={campo}>
            <option value="n-de-t">1 de 10</option><option value="n">1</option><option value="pagina-n">Página 1</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className={rotulo}>Começa em</span>
          <input type="number" min={1} value={inicio} onChange={e => setInicio(Number(e.target.value))} aria-label="Primeiro número" className={`${campo} w-24`} /></label></>;
      case "marca": return <label className="flex flex-1 flex-col gap-1"><span className={rotulo}>Texto</span>
        <input value={textoMarca} maxLength={60} onChange={e => setTextoMarca(e.target.value)} aria-label="Texto da marca d'água" className={campo} /></label>;
      case "imagem-formato": return grupo("Converter para", <>{radio("jpg", formatoConv, setFormatoConv, "JPG")}{radio("png", formatoConv, setFormatoConv, "PNG")}{radio("webp", formatoConv, setFormatoConv, "WebP")}</>);
      default: return null;
    }
  }, [ferramenta, intervalo, paginasPdf, modoDividir, modoImagem, formatoImg, dpi, nivel, posicao, formatoNumero, inicio, textoMarca, formatoConv]);

  // ---------- tela inicial: as ferramentas ----------
  if (!ferramenta) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Bloco de notas</button>
          <h1 className="text-xl font-bold text-slate-800">Converter arquivos</h1>
        </div>
        <p className="mb-5 text-sm text-slate-500">Escolha o que fazer. Os arquivos são trabalhados aqui no seu aparelho: nada é enviado ao servidor.</p>
        {GRUPOS.map(g => (
          <section key={g} aria-label={g} className="mb-5">
            <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{g}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {FERRAMENTAS.filter(f => f.grupo === g).map(f => (
                <button key={f.id} type="button" onClick={() => escolher(f.id)}
                  className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: f.cor }}><f.icone className="h-5 w-5" /></span>
                  <span className="text-sm font-bold text-slate-800">{f.titulo}</span>
                  <span className="text-[11px] leading-snug text-slate-500">{f.texto}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ---------- ferramenta aberta ----------
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={() => escolher(null)}><ArrowLeft className="h-4 w-4" />Ferramentas</button>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: ferramenta.cor }}><ferramenta.icone className="h-4 w-4" /></span>
        <h1 className="text-xl font-bold text-slate-800">{ferramenta.titulo}</h1>
      </div>

      <input ref={entrada} type="file" multiple={ferramenta.varios} accept={ferramenta.aceita} className="hidden" aria-label="Arquivos para converter"
        onChange={e => { if (e.target.files) adicionar(e.target.files); e.target.value = ""; }} />

      {!arquivos.length ? (
        <button type="button" onClick={() => entrada.current?.click()}
          onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition ${arrastando ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
          <Upload className="h-10 w-10 text-slate-400" />
          <span className="text-base font-bold text-slate-700">{ferramenta.varios ? "Escolher arquivos" : "Escolher arquivo"}</span>
          <span className="text-xs text-slate-500">ou arraste para cá · {ferramenta.texto}</span>
        </button>
      ) : (
        <div className="space-y-4">
          {ferramenta.id === "organizar" ? (
            <section aria-label="Páginas" className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="mr-auto truncate font-bold text-slate-700">{arquivos[0].name}</span>
                <span>{ordem.length} de {paginasPdf ?? "…"} página(s)</span>
                <button type="button" className={botao} onClick={() => setOrdem(o => o.map(p => ({ ...p, giro: p.giro + 90 })))}><RotateCw className="h-3.5 w-3.5" />Girar todas</button>
                <button type="button" className={botao} onClick={limpar}>Trocar arquivo</button>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {ordem.map((p, i) => (
                  <li key={`${p.pagina}-${i}`} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 p-2" aria-label={`Página ${p.pagina}`}>
                    <div className="flex h-32 w-full items-center justify-center overflow-hidden">
                      {fotos[p.pagina - 1]
                        ? <img src={fotos[p.pagina - 1]} alt={`Página ${p.pagina}`} className="max-h-28 max-w-full shadow transition-transform" style={{ transform: `rotate(${p.giro}deg)` }} />
                        : <Loader2 className="h-5 w-5 animate-spin text-slate-300" />}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{p.pagina}</span>
                    <div className="flex flex-wrap justify-center gap-0.5">
                      <button type="button" aria-label={`Mover página ${p.pagina} para trás`} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => setOrdem(o => { const n = [...o]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ArrowLeft className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Girar página ${p.pagina} para a esquerda`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOrdem(o => o.map((x, j) => (j === i ? { ...x, giro: x.giro - 90 } : x)))}><RotateCcw className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Girar página ${p.pagina} para a direita`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOrdem(o => o.map((x, j) => (j === i ? { ...x, giro: x.giro + 90 } : x)))}><RotateCw className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Tirar página ${p.pagina}`} className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => setOrdem(o => o.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Mover página ${p.pagina} para a frente`} disabled={i === ordem.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => setOrdem(o => { const n = [...o]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ArrowLeft className="h-3.5 w-3.5 rotate-180" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section aria-label="Arquivos escolhidos" className="rounded-2xl border border-slate-200 bg-white p-3">
              <ul className="divide-y divide-slate-100">
                {arquivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-6 text-right text-xs font-bold text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{tamanhoLegivel(f.size)}</span>
                    {ferramenta.varios && <>
                      <button type="button" aria-label={`Subir ${f.name}`} disabled={i === 0} onClick={() => mover(i, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Descer ${f.name}`} disabled={i === arquivos.length - 1} onClick={() => mover(i, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    </>}
                    <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => { setArquivos(l => l.filter((_, j) => j !== i)); setResultado(null); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                {ferramenta.varios && <button type="button" className={botao} onClick={() => entrada.current?.click()}><Upload className="h-3.5 w-3.5" />Adicionar mais</button>}
                {!ferramenta.varios && <button type="button" className={botao} onClick={() => entrada.current?.click()}>Trocar arquivo</button>}
              </div>
            </section>
          )}

          {opcoes && <section aria-label="Opções" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">{opcoes}</section>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={botaoPrincipal} onClick={() => void executar()} disabled={!!trabalhando}>
              {trabalhando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ferramenta.icone className="h-4 w-4" />}{ferramenta.titulo}
            </button>
            {trabalhando && <span role="status" className="text-sm text-slate-500">{trabalhando}</span>}
          </div>
        </div>
      )}

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {resultado && (
        <section aria-label="Resultado" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-900">Pronto!</p>
            <p className="truncate text-xs text-emerald-800">{resultado.arquivo.name} · {tamanhoLegivel(resultado.arquivo.size)}
              {resultado.antes != null && ` (era ${tamanhoLegivel(resultado.antes)}${resultado.arquivo.size < resultado.antes ? `, ${Math.round((1 - resultado.arquivo.size / resultado.antes) * 100)}% menor` : "; este PDF já estava enxuto e ficou como estava"})`}</p>
          </div>
          {resultado.pdf && <button type="button" className={botao} onClick={() => onAbrirNoCaderno(resultado.arquivo)}><NotebookPen className="h-3.5 w-3.5" />Abrir num caderno</button>}
          <button type="button" className={botaoPrincipal} onClick={() => baixarArquivo(resultado.arquivo)}><Download className="h-4 w-4" />Baixar</button>
        </section>
      )}
    </div>
  );
}

function aceita(f: Ferramenta, arquivo: File): boolean {
  const nome = arquivo.name.toLowerCase();
  if (f.aceita === PDF) return nome.endsWith(".pdf") || arquivo.type === "application/pdf";
  if (f.aceita === IMAGENS) return arquivo.type.startsWith("image/") && !/hei[cf]$/.test(nome);
  return f.aceita.split(",").some(ext => nome.endsWith(ext));
}
