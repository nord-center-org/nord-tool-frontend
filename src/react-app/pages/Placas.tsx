import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toBlob } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { Copy, Download, FileDown, ImagePlus, LayoutTemplate, Loader2, Pencil, Plus, Signpost, Trash2, X } from "lucide-react";

import PlacaVisual from "@/react-app/components/placas/PlacaVisual";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useObra } from "@/react-app/hooks/useObra";
import { placaService, type ModeloPlaca, type Placa, type TipoImagemPlaca } from "@/react-app/services/PlacaService";
import {
  CONFIG_EXEMPLO, FOLHA, FONTES, VALORES_EXEMPLO, lerConfig, lerValores, linhasDoTexto, nomeArquivoPlaca, type ConfigPlaca, type Fonte, type ValoresPlaca,
} from "@/react-app/utils/placas";
import { podeAcessar } from "@/react-app/utils/sessao";

// ---------------------------------------------------------------- imagens do modelo (baixadas uma vez por versão)

const cacheImagens = new Map<string, Promise<string | null>>();
function urlImagem(m: ModeloPlaca, tipo: TipoImagemPlaca): Promise<string | null> {
  const versao = tipo === "fundo" ? m.versaoFundo : m.versaoLogo;
  if (!(tipo === "fundo" ? m.inFundo : m.inLogo)) return Promise.resolve(null);
  const chave = `${m.id}:${tipo}:${versao}`;
  let p = cacheImagens.get(chave);
  if (!p) {
    // Data URL (e não blob:) para a exportação em PNG/PDF levar a imagem junto.
    p = placaService.imagem(m.id, tipo, versao).then(b => new Promise<string>((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => erro(r.error);
      r.readAsDataURL(b);
    })).catch(() => null);
    cacheImagens.set(chave, p);
  }
  return p;
}

function useImagens(m: ModeloPlaca | null) {
  const [imgs, setImgs] = useState<{ fundo: string | null; logo: string | null }>({ fundo: null, logo: null });
  useEffect(() => {
    let vivo = true;
    if (!m) { setImgs({ fundo: null, logo: null }); return; }
    Promise.all([urlImagem(m, "fundo"), urlImagem(m, "logo")]).then(([fundo, logo]) => { if (vivo) setImgs({ fundo, logo }); });
    return () => { vivo = false; };
  }, [m]);
  return imgs;
}

// ---------------------------------------------------------------- exportação

async function imagemDaPlaca(no: HTMLElement): Promise<Blob> {
  const blob = await toBlob(no, { pixelRatio: 3, cacheBust: true, width: no.offsetWidth, height: no.offsetHeight });
  if (!blob) throw new Error("Não foi possível gerar a imagem da placa.");
  return blob;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** PDF A4 com a placa ocupando a folha inteira (pronto para imprimir). */
async function pdfDaPlaca(png: Blob, retrato: boolean): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const [w, h] = retrato ? [595.28, 841.89] : [841.89, 595.28];
  const pagina = pdf.addPage([w, h]);
  const imagem = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
  pagina.drawImage(imagem, { x: 0, y: 0, width: w, height: h });
  return new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" });
}

// ---------------------------------------------------------------- miniatura

function Miniatura({ config, valores, modelo, largura }: { config: ConfigPlaca; valores: ValoresPlaca; modelo: ModeloPlaca | null; largura: number }) {
  const imgs = useImagens(modelo);
  const folha = FOLHA[config.orientacao];
  const escala = largura / folha.largura;
  return (
    <div style={{ width: largura, height: folha.altura * escala }} className="overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200">
      <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: folha.largura, height: folha.altura }}>
        <PlacaVisual config={config} valores={valores} fundo={imgs.fundo} logo={imgs.logo} />
      </div>
    </div>
  );
}

/** Mede a largura disponível para a prévia caber na tela. */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, el.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}

// ---------------------------------------------------------------- campos

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return <label className="block text-xs font-bold text-slate-600">{texto}<div className="mt-1 font-normal">{children}</div></label>;
}
function Cor({ valor, onMudar, rotulo }: { valor: string; onMudar: (v: string) => void; rotulo: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
      <input type="color" value={valor} onChange={e => onMudar(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" aria-label={rotulo} />
      {rotulo}
    </label>
  );
}
function Liga({ valor, onMudar, rotulo }: { valor: boolean; onMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <input type="checkbox" checked={valor} onChange={e => onMudar(e.target.checked)} className="h-4 w-4 accent-blue-600" /> {rotulo}
    </label>
  );
}

// ---------------------------------------------------------------- editor de placa

function EditorPlaca({ placa, modelos, onFechar, onSalvo, editavel }: {
  placa: Placa | null; modelos: ModeloPlaca[]; onFechar: () => void; onSalvo: (p: Placa) => void; editavel: boolean;
}) {
  const { obra } = useObra();
  const ativos = modelos.filter(m => m.inAtivo || m.id === placa?.idModelo);
  const inicial = placa ? lerValores(placa.valores) : { ...VALORES_EXEMPLO, cabecalho: obra?.nmObra?.toUpperCase() ?? "", linhas: [] };
  const [idModelo, setIdModelo] = useState<number>(placa?.idModelo ?? ativos[0]?.id ?? 0);
  const [titulo, setTitulo] = useState(placa?.nmTitulo ?? "");
  const [cabecalho, setCabecalho] = useState(inicial.cabecalho);
  const [texto, setTexto] = useState(inicial.linhas.join("\n"));
  const [rodape, setRodape] = useState(inicial.rodape);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState<"png" | "pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const modelo = modelos.find(m => m.id === idModelo) ?? null;
  const config = useMemo(() => lerConfig(modelo?.config), [modelo]);
  const valores: ValoresPlaca = { cabecalho, linhas: linhasDoTexto(texto), rodape };
  const imgs = useImagens(modelo);
  const exportar = useRef<HTMLDivElement>(null);
  const { ref: area, largura } = useLargura<HTMLDivElement>();
  const nome = titulo.trim() || valores.linhas[0] || "placa";

  const salvar = async () => {
    if (!modelo) { setErro("Escolha um modelo."); return; }
    if (!titulo.trim() && !valores.linhas.length) { setErro("Escreva o texto da placa."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const dados = { idModelo, nmTitulo: (titulo.trim() || valores.linhas[0]).slice(0, 120), valores };
      onSalvo(placa ? await placaService.alterar(placa.id, dados) : await placaService.criar(dados));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a placa.");
    } finally {
      setSalvando(false);
    }
  };

  const baixarComo = async (tipo: "png" | "pdf") => {
    if (!exportar.current) return;
    setBaixando(tipo);
    setErro(null);
    try {
      const png = await imagemDaPlaca(exportar.current);
      baixar(tipo === "png" ? png : await pdfDaPlaca(png, config.orientacao === "retrato"), nomeArquivoPlaca(nome, tipo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível baixar a placa.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={placa ? "Editar placa" : "Nova placa"}>
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="flex-1 text-lg font-black text-slate-900">{placa ? "Editar placa" : "Nova placa"}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          <div className="space-y-3 lg:w-80 lg:shrink-0">
            <Rotulo texto="Modelo">
              <select value={idModelo} onChange={e => setIdModelo(Number(e.target.value))} disabled={!editavel} className={campo}>
                {ativos.map(m => <option key={m.id} value={m.id}>{m.nmModelo}</option>)}
              </select>
            </Rotulo>
            <Rotulo texto="Nome da placa (para achar na lista)">
              <input value={titulo} maxLength={120} disabled={!editavel} onChange={e => setTitulo(e.target.value)} className={campo} placeholder="Ex.: Escoramento do 5º pavimento" />
            </Rotulo>
            {config.cabecalho.ativo && (
              <Rotulo texto={`Cabeçalho (${config.cabecalho.rotulo || "campo"})`}>
                <input value={cabecalho} maxLength={80} disabled={!editavel} onChange={e => setCabecalho(e.target.value)} className={campo} />
              </Rotulo>
            )}
            <Rotulo texto="Texto da placa (uma linha por item)">
              <textarea value={texto} rows={6} disabled={!editavel} onChange={e => setTexto(e.target.value)} className={campo}
                placeholder={"Viga barrote sem madeira\nAprumadores de pilar\nEscoramento suporte p/guarda corpo"} />
            </Rotulo>
            {config.rodape.ativo && (
              <Rotulo texto="Rodapé (vazio = o do modelo)">
                <textarea value={rodape} rows={3} maxLength={1500} disabled={!editavel} onChange={e => setRodape(e.target.value)} className={campo} />
              </Rotulo>
            )}
            {erro && <p role="alert" className="text-sm font-semibold text-red-600">{erro}</p>}
          </div>
          <div ref={area} className="min-w-0 flex-1">
            <Miniatura config={config} valores={valores} modelo={modelo} largura={Math.min(largura, 900)} />
            <p className="mt-2 text-xs text-slate-500">Folha A4 {config.orientacao === "paisagem" ? "deitada" : "em pé"}. O PDF sai do tamanho da folha, pronto para imprimir.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={() => baixarComo("png")} disabled={!!baixando || !modelo}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {baixando === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar imagem
          </button>
          <button type="button" onClick={() => baixarComo("pdf")} disabled={!!baixando || !modelo}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {baixando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Baixar PDF
          </button>
          {editavel && (
            <button type="button" onClick={salvar} disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar placa
            </button>
          )}
        </div>
      </div>
      {/* A placa em tamanho real, fora da tela: é ela que vira PNG/PDF. */}
      <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0 }}>
        <PlacaVisual ref={exportar} config={config} valores={valores} fundo={imgs.fundo} logo={imgs.logo} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- editor de modelo

function EditorModelo({ modelo, onFechar, onSalvo }: { modelo: ModeloPlaca; onFechar: () => void; onSalvo: (m: ModeloPlaca) => void }) {
  const [nome, setNome] = useState(modelo.nmModelo);
  const [ativo, setAtivo] = useState(modelo.inAtivo);
  const [c, setC] = useState<ConfigPlaca>(() => lerConfig(modelo.config));
  const [atual, setAtual] = useState(modelo);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<TipoImagemPlaca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const tipoArquivo = useRef<TipoImagemPlaca>("fundo");
  const { ref: area, largura } = useLargura<HTMLDivElement>();
  const mudar = <K extends keyof ConfigPlaca>(k: K, v: Partial<ConfigPlaca[K]>) => setC(x => ({ ...x, [k]: typeof v === "object" ? { ...(x[k] as object), ...v } : v }));

  const salvar = async () => {
    if (!nome.trim()) { setErro("Dê um nome ao modelo."); return; }
    setSalvando(true);
    setErro(null);
    try { onSalvo(await placaService.alterarModelo(modelo.id, { nmModelo: nome.trim(), config: c, inAtivo: ativo })); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar o modelo."); }
    finally { setSalvando(false); }
  };
  const enviar = async (f: File) => {
    const tipo = tipoArquivo.current;
    setEnviando(tipo);
    setErro(null);
    try { setAtual(await placaService.enviarImagem(modelo.id, tipo, f, f.name)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem."); }
    finally { setEnviando(null); }
  };
  const remover = async (tipo: TipoImagemPlaca) => {
    try { setAtual(await placaService.removerImagem(modelo.id, tipo)); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível tirar a imagem."); }
  };
  const botaoImagem = (tipo: TipoImagemPlaca, rotulo: string, tem: boolean) => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => { tipoArquivo.current = tipo; arquivo.current?.click(); }} disabled={!!enviando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
        {enviando === tipo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {tem ? `Trocar ${rotulo}` : `Enviar ${rotulo}`}
      </button>
      {tem && <button type="button" onClick={() => void remover(tipo)} className="text-xs font-bold text-red-600 hover:underline">Tirar</button>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Editar modelo de placa">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="flex-1 text-lg font-black text-slate-900">Modelo de placa</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          <div className="space-y-4 lg:w-80 lg:shrink-0">
            <Rotulo texto="Nome do modelo"><input value={nome} maxLength={80} onChange={e => setNome(e.target.value)} className={campo} /></Rotulo>
            <Liga valor={ativo} onMudar={setAtivo} rotulo="Disponível para placas novas" />
            <Rotulo texto="Folha">
              <select value={c.orientacao} onChange={e => setC(x => ({ ...x, orientacao: e.target.value as ConfigPlaca["orientacao"] }))} className={campo}>
                <option value="paisagem">A4 deitada</option><option value="retrato">A4 em pé</option>
              </select>
            </Rotulo>

            <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">Fundo e marca d'água</legend>
              {botaoImagem("fundo", "foto de fundo", atual.inFundo)}
              <Cor valor={c.fundo.cor} onMudar={v => mudar("fundo", { cor: v })} rotulo="Cor por cima da foto" />
              <Rotulo texto={`Escurecer a foto: ${Math.round(c.fundo.escurecer * 100)}%`}>
                <input type="range" min={0} max={0.95} step={0.05} value={c.fundo.escurecer} onChange={e => mudar("fundo", { escurecer: Number(e.target.value) })} className="w-full" />
              </Rotulo>
            </fieldset>

            <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">Topo</legend>
              <Liga valor={c.logo.ativo} onMudar={v => mudar("logo", { ativo: v })} rotulo="Logo" />
              {c.logo.ativo && (<>
                {botaoImagem("logo", "logo", atual.inLogo)}
                <Rotulo texto={`Altura do logo: ${c.logo.altura}px`}><input type="range" min={40} max={160} value={c.logo.altura} onChange={e => mudar("logo", { altura: Number(e.target.value) })} className="w-full" /></Rotulo>
              </>)}
              <Liga valor={c.cabecalho.ativo} onMudar={v => mudar("cabecalho", { ativo: v })} rotulo="Caixa do cabeçalho" />
              {c.cabecalho.ativo && <Rotulo texto="Rótulo do campo"><input value={c.cabecalho.rotulo} maxLength={40} onChange={e => mudar("cabecalho", { rotulo: e.target.value })} className={campo} /></Rotulo>}
            </fieldset>

            <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">Painel e texto</legend>
              <Cor valor={c.painel.cor} onMudar={v => mudar("painel", { cor: v })} rotulo="Cor do painel" />
              <Rotulo texto={`Cantos arredondados: ${c.painel.raio}px`}><input type="range" min={0} max={120} value={c.painel.raio} onChange={e => mudar("painel", { raio: Number(e.target.value) })} className="w-full" /></Rotulo>
              <Liga valor={c.quadro.borda} onMudar={v => mudar("quadro", { borda: v })} rotulo="Borda no quadro do texto" />
              <Cor valor={c.quadro.corTexto} onMudar={v => mudar("quadro", { corTexto: v })} rotulo="Cor do texto" />
              <Rotulo texto="Fonte">
                <select value={c.quadro.fonte} onChange={e => mudar("quadro", { fonte: e.target.value as Fonte })} className={campo}>
                  {(Object.keys(FONTES) as Fonte[]).map(f => <option key={f} value={f}>{FONTES[f].rotulo}</option>)}
                </select>
              </Rotulo>
              <Liga valor={c.quadro.negrito} onMudar={v => mudar("quadro", { negrito: v })} rotulo="Negrito" />
              <Rotulo texto="Alinhamento">
                <select value={c.quadro.alinhamento} onChange={e => mudar("quadro", { alinhamento: e.target.value as ConfigPlaca["quadro"]["alinhamento"] })} className={campo}>
                  <option value="left">À esquerda</option><option value="center">Centralizado</option><option value="right">À direita</option>
                </select>
              </Rotulo>
              <Rotulo texto={c.quadro.tamanho ? `Tamanho da letra: ${c.quadro.tamanho}px` : "Tamanho da letra: automático (o maior que cabe)"}>
                <input type="range" min={0} max={120} step={2} value={c.quadro.tamanho} onChange={e => mudar("quadro", { tamanho: Number(e.target.value) })} className="w-full" />
              </Rotulo>
            </fieldset>

            <fieldset className="space-y-2 rounded-2xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">Rodapé</legend>
              <Liga valor={c.rodape.ativo} onMudar={v => mudar("rodape", { ativo: v })} rotulo="Rodapé" />
              {c.rodape.ativo && (<>
                <Rotulo texto="Título"><input value={c.rodape.titulo} maxLength={80} onChange={e => mudar("rodape", { titulo: e.target.value })} className={campo} /></Rotulo>
                <Rotulo texto="Texto"><textarea value={c.rodape.texto} rows={4} maxLength={1500} onChange={e => mudar("rodape", { texto: e.target.value })} className={campo} /></Rotulo>
                <div className="flex flex-wrap gap-3">
                  <Cor valor={c.rodape.cor} onMudar={v => mudar("rodape", { cor: v })} rotulo="Fundo" />
                  <Cor valor={c.rodape.corTexto} onMudar={v => mudar("rodape", { corTexto: v })} rotulo="Texto" />
                </div>
                <Rotulo texto={`Tamanho do texto: ${c.rodape.tamanho}px`}><input type="range" min={8} max={20} value={c.rodape.tamanho} onChange={e => mudar("rodape", { tamanho: Number(e.target.value) })} className="w-full" /></Rotulo>
              </>)}
            </fieldset>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
            {erro && <p role="alert" className="text-sm font-semibold text-red-600">{erro}</p>}
          </div>
          <div ref={area} className="min-w-0 flex-1">
            <div className="lg:sticky lg:top-0">
              <Miniatura config={c} valores={VALORES_EXEMPLO} modelo={atual} largura={Math.min(largura, 900)} />
              <p className="mt-2 text-xs text-slate-500">Prévia com o texto de exemplo. As imagens entram assim que são enviadas.</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar modelo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- página

/**
 * Placas de obra: cada placa sai de um modelo (fundo com foto e marca d'água, logo, cabeçalho, quadro de texto e
 * rodapé) e baixa em PNG ou PDF A4. O ADMIN de Placas mantém os modelos; quem edita cria as placas da obra.
 */
export default function Placas() {
  const { usuario } = useAuth();
  const podeEditar = podeAcessar(usuario?.permissoes, "PLACAS", "ESCRITA");
  const admin = podeAcessar(usuario?.permissoes, "PLACAS", "ADMIN");
  const [aba, setAba] = useState<"placas" | "modelos">("placas");
  const [modelos, setModelos] = useState<ModeloPlaca[] | null>(null);
  const [placas, setPlacas] = useState<Placa[] | null>(null);
  const [editando, setEditando] = useState<Placa | "nova" | null>(null);
  const [modeloEditando, setModeloEditando] = useState<ModeloPlaca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoModelo, setCriandoModelo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([placaService.modelos(), placaService.listar()]);
      setModelos(m);
      setPlacas(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as placas.");
      setModelos(m => m ?? []);
      setPlacas(p => p ?? []);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const porId = useMemo(() => new Map((modelos ?? []).map(m => [m.id, m])), [modelos]);
  const temAtivo = (modelos ?? []).some(m => m.inAtivo);

  const novoModelo = async (copiar?: ModeloPlaca) => {
    setCriandoModelo(true);
    setErro(null);
    try {
      const m = await placaService.criarModelo(copiar
        ? { nmModelo: `${copiar.nmModelo} (cópia)`.slice(0, 80), config: lerConfig(copiar.config) }
        : { nmModelo: "Aviso de obra", config: CONFIG_EXEMPLO });
      setModelos(l => [...(l ?? []), m]);
      setModeloEditando(m);
      setAba("modelos");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o modelo.");
    } finally {
      setCriandoModelo(false);
    }
  };

  const excluirPlaca = async (p: Placa) => {
    if (!window.confirm(`Excluir a placa “${p.nmTitulo}”?`)) return;
    try { await placaService.excluir(p.id); setPlacas(l => l?.filter(x => x.id !== p.id) ?? null); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir."); }
  };
  const excluirModelo = async (m: ModeloPlaca) => {
    if (!window.confirm(`Excluir o modelo “${m.nmModelo}”? Se já houver placas com ele, ele só deixa de aparecer para placas novas.`)) return;
    try { await placaService.excluirModelo(m.id); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir o modelo."); }
  };

  const botaoAba = (id: typeof aba, rotulo: string) => (
    <button type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
      className={`rounded-lg px-3 py-1.5 text-sm font-bold ${aba === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{rotulo}</button>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CabecalhoPagina icone={Signpost} titulo="Placas" subtitulo="Placas de aviso da obra a partir de modelos, prontas para imprimir"
        acoes={podeEditar && aba === "placas" ? (
          <button type="button" onClick={() => setEditando("nova")} disabled={!temAtivo}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Nova placa
          </button>
        ) : admin && aba === "modelos" ? (
          <button type="button" onClick={() => void novoModelo()} disabled={criandoModelo}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            {criandoModelo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo modelo
          </button>
        ) : undefined} />

      {admin && <div role="tablist" aria-label="Placas" className="mb-4 flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{botaoAba("placas", "Placas")}{botaoAba("modelos", "Modelos")}</div>}
      {erro && (
        <p role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          {erro}<button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </p>
      )}

      {modelos === null || placas === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : aba === "placas" ? (
        !temAtivo && placas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            <LayoutTemplate className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            {admin ? (
              <>Ainda não há modelo de placa. <button type="button" onClick={() => void novoModelo()} className="font-bold text-blue-600 hover:underline">Criar o modelo de aviso de obra</button> (fundo com foto, logo, “OBRA:”, quadro de texto e a política no rodapé).</>
            ) : "Ainda não há modelo de placa. Peça ao administrador para criar um."}
          </div>
        ) : placas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nenhuma placa nesta obra ainda.{podeEditar && <button type="button" onClick={() => setEditando("nova")} className="ml-1 font-bold text-blue-600 hover:underline">Criar a primeira</button>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {placas.map(p => {
              const m = porId.get(p.idModelo) ?? null;
              return (
                <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <button type="button" onClick={() => setEditando(p)} className="block w-full" aria-label={`Abrir a placa ${p.nmTitulo}`}>
                    <Miniatura config={lerConfig(m?.config)} valores={lerValores(p.valores)} modelo={m} largura={320} />
                  </button>
                  <div className="mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-slate-800">{p.nmTitulo}</h3>
                      <p className="truncate text-xs text-slate-500">{m?.nmModelo ?? "Modelo"} · {new Date(p.dhAtualizacao).toLocaleDateString("pt-BR")}{p.nmUsuario ? ` · ${p.nmUsuario}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => setEditando(p)} aria-label={`Editar ${p.nmTitulo}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    {podeEditar && <button type="button" onClick={() => void excluirPlaca(p)} aria-label={`Excluir ${p.nmTitulo}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modelos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
              Nenhum modelo. <button type="button" onClick={() => void novoModelo()} className="font-bold text-blue-600 hover:underline">Criar o modelo de aviso de obra</button>
            </div>
          )}
          {modelos.map(m => (
            <article key={m.id} className={`rounded-2xl border bg-white p-3 shadow-sm ${m.inAtivo ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
              <button type="button" onClick={() => setModeloEditando(m)} className="block w-full" aria-label={`Editar o modelo ${m.nmModelo}`}>
                <Miniatura config={lerConfig(m.config)} valores={VALORES_EXEMPLO} modelo={m} largura={320} />
              </button>
              <div className="mt-2 flex items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-bold text-slate-800">{m.nmModelo}{!m.inAtivo && <span className="ml-1 text-xs font-semibold text-slate-500">(desativado)</span>}</h3>
                <button type="button" onClick={() => void novoModelo(m)} aria-label={`Copiar o modelo ${m.nmModelo}`} title="Copiar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Copy className="h-4 w-4" /></button>
                <button type="button" onClick={() => setModeloEditando(m)} aria-label={`Editar o modelo ${m.nmModelo}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => void excluirModelo(m)} aria-label={`Excluir o modelo ${m.nmModelo}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editando && modelos && (
        <EditorPlaca placa={editando === "nova" ? null : editando} modelos={modelos} editavel={podeEditar} onFechar={() => setEditando(null)}
          onSalvo={p => { setPlacas(l => [p, ...(l ?? []).filter(x => x.id !== p.id)]); setEditando(null); }} />
      )}
      {modeloEditando && (
        <EditorModelo key={modeloEditando.id} modelo={modeloEditando} onFechar={() => { setModeloEditando(null); void carregar(); }}
          onSalvo={m => { setModelos(l => (l ?? []).map(x => (x.id === m.id ? m : x))); setModeloEditando(null); }} />
      )}
    </div>
  );
}
