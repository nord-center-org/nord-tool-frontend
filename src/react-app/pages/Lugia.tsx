import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Bot, Check, Copy, Crop, FileText, Image as ImageIcon, Loader2, MessageSquarePlus, PanelLeft, Paperclip, Pencil, Send, Sparkles, Square, Trash2, X,
} from "lucide-react";

import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useCapturaLugia } from "@/react-app/hooks/useCapturaLugia";
import { lerArquivoBase64, lugiaDisponivel, lugiaService as servico, type AnexoEnvio, type ConversaResumo } from "@/react-app/services/LugiaService";
import {
  agruparModelos, lerModeloPreferido, MAX_ANEXOS, modeloInicial, ROTULO_PROVEDOR, salvarModeloPreferido, textoDaMensagem, validarArquivo,
  type MensagemTela, type ModeloIa,
} from "@/react-app/utils/lugia";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);

interface AnexoLocal extends AnexoEnvio {
  chave: string;
}

/** Lugia: chat com Claude, ChatGPT e Gemini num lugar só, com histórico e anexos. */
export default function LugiaPage() {
  // Conversa e rascunho ficam guardados enquanto a pessoa vai a outra tela tirar um print.
  const captura = useCapturaLugia();
  const { atualizarSessao, consumirPrints, prints } = captura;
  const [modelos, setModelos] = useState<ModeloIa[] | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [idConversa, setIdConversa] = useState<number | null>(captura.sessao.idConversa);
  const [mensagens, setMensagens] = useState<MensagemTela[]>([]);
  const [texto, setTexto] = useState(captura.sessao.rascunho);
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [editando, setEditando] = useState<{ id: number; titulo: string } | null>(null);
  const cancelar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const entradaArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lugiaDisponivel()) return;
    (async () => {
      try {
        const [m, c] = await Promise.all([servico.modelos(), servico.conversas()]);
        setModelos(m.modelos);
        setModelo(modeloInicial(m.modelos, lerModeloPreferido(armazenamento())));
        setConversas(c);
      } catch (e) {
        setModelos([]);
        setErro(mensagem(e, "Não foi possível conectar à Lugia."));
      }
    })();
    return () => cancelar.current?.abort();
  }, []);

  // Voltando de um print: reabre a conversa que estava aberta.
  useEffect(() => {
    const id = captura.sessao.idConversa;
    if (!id || !lugiaDisponivel()) return;
    setCarregandoConversa(true);
    servico.mensagens(id)
      .then(setMensagens)
      .catch(e => setErro(mensagem(e, "Não foi possível abrir a conversa.")))
      .finally(() => setCarregandoConversa(false));
    // Só na montagem: depois disso a própria tela controla a conversa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { atualizarSessao({ rascunho: texto }); }, [texto, atualizarSessao]);
  useEffect(() => { atualizarSessao({ idConversa }); }, [idConversa, atualizarSessao]);

  // Prints marcados em outras telas entram como anexos da próxima mensagem.
  useEffect(() => {
    if (prints.length === 0) return;
    const novos = consumirPrints();
    setAnexos(atuais => {
      const cabem = Math.max(0, MAX_ANEXOS - atuais.length);
      if (novos.length > cabem) setErro(`No máximo ${MAX_ANEXOS} anexos por mensagem.`);
      return [...atuais, ...novos.slice(0, cabem).map(p => ({ chave: `${p.nome}-${Math.random()}`, nome: p.nome, mime: p.mime, base64: p.base64 }))];
    });
    const tela = novos[novos.length - 1]?.tela;
    if (tela) setTexto(atual => (atual.trim() ? atual : `Na tela ${tela}: `));
  }, [prints, consumirPrints]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens]);

  const grupos = useMemo(() => agruparModelos(modelos ?? []), [modelos]);

  const escolherModelo = (id: string) => {
    setModelo(id);
    salvarModeloPreferido(armazenamento(), id);
  };

  const novaConversa = () => {
    if (enviando) return;
    setIdConversa(null);
    setMensagens([]);
    setErro(null);
    setListaAberta(false);
  };

  const abrirConversa = useCallback(async (id: number) => {
    if (enviando) return;
    setListaAberta(false);
    setErro(null);
    setIdConversa(id);
    setCarregandoConversa(true);
    try {
      setMensagens(await servico.mensagens(id));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível abrir a conversa."));
    } finally {
      setCarregandoConversa(false);
    }
  }, [enviando]);

  const excluirConversa = async (id: number) => {
    if (!window.confirm("Excluir esta conversa?")) return;
    try {
      await servico.excluir(id);
      setConversas(l => l.filter(c => c.id !== id));
      if (id === idConversa) novaConversa();
    } catch (e) {
      setErro(mensagem(e, "Não foi possível excluir a conversa."));
    }
  };

  const salvarTitulo = async () => {
    if (!editando) return;
    const titulo = editando.titulo.trim();
    setEditando(null);
    if (!titulo) return;
    try {
      await servico.renomear(editando.id, titulo);
      setConversas(l => l.map(c => (c.id === editando.id ? { ...c, titulo } : c)));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível renomear a conversa."));
    }
  };

  const anexar = async (arquivos: FileList | null) => {
    if (!arquivos) return;
    let total = anexos.length;
    for (const arquivo of Array.from(arquivos)) {
      const problema = validarArquivo(arquivo, total);
      if (problema) {
        setErro(problema);
        continue;
      }
      total++;
      try {
        const base64 = await lerArquivoBase64(arquivo);
        setAnexos(l => [...l, { chave: `${arquivo.name}-${arquivo.lastModified}-${Math.random()}`, nome: arquivo.name, mime: arquivo.type, base64 }]);
      } catch (e) {
        setErro(mensagem(e, `Não foi possível ler ${arquivo.name}.`));
      }
    }
    if (entradaArquivo.current) entradaArquivo.current.value = "";
  };

  const enviar = async (evento?: FormEvent) => {
    evento?.preventDefault();
    if (enviando || !modelo || (!texto.trim() && anexos.length === 0)) return;
    const provedor = modelos?.find(m => m.id === modelo)?.provedor;
    const daVez: MensagemTela = {
      papel: "usuario",
      partes: [
        ...anexos.map(a => (a.mime === "application/pdf" ? { tipo: "pdf" as const, nome: a.nome } : { tipo: "imagem" as const, nome: a.nome, mime: a.mime })),
        ...(texto.trim() ? [{ tipo: "texto" as const, texto }] : []),
      ],
    };
    const pedido = { idConversa: idConversa ?? undefined, modelo, texto, anexos: anexos.map(({ nome, mime, base64 }) => ({ nome, mime, base64 })) };
    setMensagens(l => [...l, daVez, { papel: "assistente", provedor, partes: [{ tipo: "texto", texto: "" }] }]);
    setTexto("");
    setAnexos([]);
    setErro(null);
    setEnviando(true);

    const controle = new AbortController();
    cancelar.current = controle;
    const acrescentar = (delta: string) =>
      setMensagens(l => {
        const copia = [...l];
        const ultima = copia[copia.length - 1];
        copia[copia.length - 1] = { ...ultima, partes: [{ tipo: "texto", texto: textoDaMensagem(ultima) + delta }] };
        return copia;
      });

    try {
      await servico.conversar(pedido, {
        onConversa: id => {
          if (!idConversa) {
            setIdConversa(id);
            const titulo = texto.trim().replace(/\s+/g, " ").slice(0, 60) || anexos[0]?.nome || "Nova conversa";
            setConversas(l => [{ id, titulo, atualizadaEm: new Date().toISOString() }, ...l.filter(c => c.id !== id)]);
          }
        },
        onTexto: acrescentar,
        onErro: m => setErro(m),
      }, controle.signal);
    } catch (e) {
      if (!controle.signal.aborted) setErro(mensagem(e, "Não foi possível enviar a mensagem."));
    } finally {
      setEnviando(false);
      cancelar.current = null;
      // Resposta vazia (erro antes do primeiro texto) não fica como balão em branco.
      setMensagens(l => (l.length && l[l.length - 1].papel === "assistente" && !textoDaMensagem(l[l.length - 1]) ? l.slice(0, -1) : l));
    }
  };

  const teclaNoTexto = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar();
    }
  };

  if (!lugiaDisponivel()) {
    return (
      <div className="mx-auto max-w-3xl">
        <CabecalhoPagina icone={Sparkles} titulo="Lugia" subtitulo="Claude, ChatGPT e Gemini num lugar só" />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="status">
          A Lugia ainda não foi configurada neste ambiente (defina VITE_LUGIA_BASE_URL no build).
        </p>
      </div>
    );
  }

  const listaConversas = (
    <nav aria-label="Conversas" className="flex h-full flex-col gap-2">
      <button type="button" onClick={novaConversa} disabled={enviando}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
        <MessageSquarePlus className="h-4 w-4" /> Nova conversa
      </button>
      <p className="mt-2 px-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Histórico</p>
      <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {conversas.length === 0 && <li className="px-2 py-1 text-sm text-slate-400">Nenhuma conversa ainda.</li>}
        {conversas.map(c => (
          <li key={c.id} className={`group flex items-center gap-1 rounded-xl ${c.id === idConversa ? "bg-blue-50" : "hover:bg-slate-100"}`}>
            {editando?.id === c.id ? (
              <input autoFocus value={editando.titulo} maxLength={200} aria-label="Título da conversa"
                onChange={e => setEditando({ id: c.id, titulo: e.target.value })}
                onBlur={() => void salvarTitulo()}
                onKeyDown={e => { if (e.key === "Enter") void salvarTitulo(); if (e.key === "Escape") setEditando(null); }}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            ) : (
              <button type="button" onClick={() => void abrirConversa(c.id)}
                className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${c.id === idConversa ? "font-bold text-blue-700" : "text-slate-700"}`}>
                {c.titulo}
              </button>
            )}
            <button type="button" aria-label="Renomear conversa" onClick={() => setEditando({ id: c.id, titulo: c.titulo })}
              className="rounded-lg p-1.5 text-slate-400 opacity-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Excluir conversa" onClick={() => void excluirConversa(c.id)}
              className="mr-1 rounded-lg p-1.5 text-slate-400 opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl flex-col">
      <CabecalhoPagina icone={Sparkles} titulo="Lugia" subtitulo="Claude, ChatGPT e Gemini num lugar só"
        acoes={
          <button type="button" onClick={() => setListaAberta(v => !v)} aria-expanded={listaAberta} aria-controls="lugia-conversas"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 md:hidden">
            <PanelLeft className="h-4 w-4" /> Conversas
          </button>
        } />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside id="lugia-conversas" className={`${listaAberta ? "fixed inset-x-4 bottom-4 top-24 z-30 shadow-xl" : "hidden"} rounded-2xl border border-slate-200 bg-white p-3 md:static md:z-auto md:block md:w-64 md:shrink-0 md:shadow-sm`}>
          {listaAberta && (
            <button type="button" aria-label="Fechar conversas" onClick={() => setListaAberta(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 md:hidden">
              <X className="h-4 w-4" />
            </button>
          )}
          {listaConversas}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            {carregandoConversa && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo conversa…</p>}
            {!carregandoConversa && mensagens.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center animate-surgir">
                <div className="rounded-2xl bg-blue-50 p-4"><Bot className="h-8 w-8 text-blue-600" /></div>
                <p className="text-lg font-bold text-slate-800">Como posso ajudar?</p>
                <p className="max-w-md text-sm text-slate-500">Escolha o modelo abaixo e converse. Dá para anexar fotos e PDFs (termos, comprovantes, plantas) e trocar de IA no meio da conversa.</p>
              </div>
            )}
            {mensagens.map((m, i) => <Balao key={i} mensagem={m} digitando={enviando && i === mensagens.length - 1 && m.papel === "assistente"} />)}
            <div ref={fim} />
          </div>

          {erro && (
            <p role="alert" className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <span>{erro}</span>
              <button type="button" aria-label="Fechar aviso" onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
            </p>
          )}

          <form onSubmit={e => void enviar(e)} className="border-t border-slate-200 p-3 sm:p-4">
            {anexos.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {anexos.map(a => (
                  <li key={a.chave} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs text-slate-700">
                    {a.mime === "application/pdf"
                      ? <FileText className="h-3.5 w-3.5 text-red-600" />
                      : <img src={`data:${a.mime};base64,${a.base64}`} alt="" className="h-7 w-10 rounded object-cover object-left-top ring-1 ring-slate-200" />}
                    <span className="max-w-[10rem] truncate">{a.nome}</span>
                    <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => setAnexos(l => l.filter(x => x.chave !== a.chave))} className="rounded p-0.5 hover:bg-slate-200">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <textarea value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={teclaNoTexto} rows={2} maxLength={100_000}
              placeholder={modelos?.length === 0 ? "Nenhum modelo disponível." : "Escreva sua mensagem (Enter envia, Shift+Enter quebra linha)"}
              aria-label="Mensagem para a Lugia" disabled={!modelo}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 disabled:bg-slate-50" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={modelo ?? ""} onChange={e => escolherModelo(e.target.value)} disabled={!modelos?.length || enviando} aria-label="Modelo de IA"
                className="min-w-0 max-w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:flex-none">
                {modelos === null && <option value="">Carregando modelos…</option>}
                {grupos.map(g => (
                  <optgroup key={g.provedor} label={ROTULO_PROVEDOR[g.provedor]}>
                    {g.modelos.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                  </optgroup>
                ))}
              </select>
              <input ref={entradaArquivo} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => void anexar(e.target.files)} />
              <button type="button" onClick={() => entradaArquivo.current?.click()} disabled={enviando} aria-label="Anexar imagem ou PDF"
                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <Paperclip className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => captura.iniciar("escolher")} disabled={enviando || anexos.length >= MAX_ANEXOS}
                title="Vá até a tela do app, marque a área e o print volta para cá"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <Crop className="h-4 w-4" /> Print do app
              </button>
              <div className="ml-auto">
                {enviando ? (
                  <button type="button" onClick={() => cancelar.current?.abort()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Square className="h-4 w-4" /> Parar
                  </button>
                ) : (
                  <button type="submit" disabled={!modelo || (!texto.trim() && anexos.length === 0)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Send className="h-4 w-4" /> Enviar
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function Balao({ mensagem: m, digitando }: { mensagem: MensagemTela; digitando: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const texto = textoDaMensagem(m);
  const doUsuario = m.papel === "usuario";
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sem permissão de área de transferência: nada a fazer.
    }
  };
  return (
    <div className={`flex ${doUsuario ? "justify-end" : "justify-start"} animate-entrada`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${doUsuario ? "bg-blue-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-800"}`}>
        {!doUsuario && m.provedor && (
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{ROTULO_PROVEDOR[m.provedor]}</p>
        )}
        {m.partes.filter(p => p.tipo !== "texto").map((p, i) => (
          <p key={i} className={`mb-1 flex items-center gap-1.5 text-xs ${doUsuario ? "text-blue-100" : "text-slate-500"}`}>
            {p.tipo === "pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {"nome" in p && p.nome ? p.nome : p.tipo === "pdf" ? "PDF" : "Imagem"}
          </p>
        ))}
        {texto && <div className="whitespace-pre-wrap break-words leading-relaxed">{texto}</div>}
        {digitando && !texto && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Pensando" />}
        {!doUsuario && texto && !digitando && (
          <button type="button" onClick={() => void copiar()} aria-label="Copiar resposta" className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
            {copiado ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
          </button>
        )}
      </div>
    </div>
  );
}
