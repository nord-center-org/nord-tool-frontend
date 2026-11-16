import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { toCanvas } from "html-to-image";
import { Camera, Loader2, X } from "lucide-react";

import { ContextoCapturaLugia, type CapturaLugia, type EstadoCaptura, type PrintPendente, type SessaoLugia } from "@/react-app/hooks/useCapturaLugia";
import { ATRIBUTO_SEM_PRINT, nomePrint, recorteNoElemento, retanguloEntre, selecaoValida, transformacaoDeslocada, type Retangulo } from "@/react-app/utils/captura";

const MAX_BYTES_PNG = 9 * 1024 * 1024;

const proximoQuadro = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * O desenho do print volta cada área rolável ao topo. Para sair como está na tela, cada área rolada volta ao topo de
 * verdade e os filhos dela andam o mesmo tanto (na tela nada muda); depois tudo volta como estava.
 */
function congelarRolagens(raiz: HTMLElement): () => void {
  const desfazer: Array<() => void> = [];
  for (const el of [raiz, ...Array.from(raiz.querySelectorAll<HTMLElement>("*"))]) {
    const rola = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    if (!rola) continue;
    // sem barra de rolagem no print (na tela, só some por um instante)
    const overflow = el.style.overflow;
    if (/(auto|scroll)/.test(getComputedStyle(el).overflow)) el.style.overflow = "hidden";
    const topo = el.scrollTop, esquerda = el.scrollLeft;
    const filhos = topo || esquerda ? Array.from(el.children).filter((f): f is HTMLElement => f instanceof HTMLElement) : [];
    // a transição (as telas têm) atrasaria o deslocamento: o print sairia antes dele
    const antes = filhos.map(f => [f.style.transform, f.style.transition] as const);
    filhos.forEach(f => {
      const atual = getComputedStyle(f).transform;
      f.style.transition = "none";
      f.style.transform = transformacaoDeslocada(esquerda, topo, atual);
    });
    if (topo || esquerda) { el.scrollTop = 0; el.scrollLeft = 0; }
    desfazer.push(() => {
      filhos.forEach((f, i) => { f.style.transform = antes[i][0]; });
      el.style.overflow = overflow;
      el.scrollTop = topo;
      el.scrollLeft = esquerda;
      // a transição só volta depois de o deslocamento sair, para a tela não "deslizar"
      requestAnimationFrame(() => filhos.forEach((f, i) => { f.style.transition = antes[i][1]; }));
    });
  }
  // o texto de exemplo (placeholder) sairia escuro, como se o campo estivesse preenchido: no print, campo vazio fica vazio
  for (const campo of Array.from(raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]"))) {
    if (campo.value) continue;
    const exemplo = campo.getAttribute("placeholder") ?? "";
    campo.setAttribute("placeholder", "");
    desfazer.push(() => campo.setAttribute("placeholder", exemplo));
  }
  return () => desfazer.reverse().forEach(f => f());
}

/** Renderiza o app como está na janela (menu lateral, conteúdo e o que estiver rolado) e recorta a seleção. */
async function capturar(selecao: Retangulo): Promise<{ base64: string; mime: string }> {
  const tela = document.querySelector<HTMLElement>("[data-print-raiz]") ?? document.querySelector<HTMLElement>("[data-tutorial-tela]");
  if (!tela) throw new Error("Não encontrei a tela para capturar.");
  const caixa = tela.getBoundingClientRect();
  const largura = Math.round(caixa.width), altura = Math.round(caixa.height);
  const escala = Math.min(2, window.devicePixelRatio || 1);
  const recorte = recorteNoElemento(selecao, { x: caixa.left, y: caixa.top, largura, altura }, escala);
  if (!recorte) throw new Error("Marque uma área dentro da tela.");

  const fundo = getComputedStyle(document.body).backgroundColor;
  const descongelar = congelarRolagens(tela);
  let imagem: HTMLCanvasElement;
  try {
    imagem = await toCanvas(tela, {
      width: largura,
      height: altura,
      pixelRatio: escala,
      backgroundColor: fundo && fundo !== "rgba(0, 0, 0, 0)" ? fundo : "#f8fafc",
      cacheBust: true,
      filter: no => !(no instanceof Element && no.hasAttribute(ATRIBUTO_SEM_PRINT)),
    });
  } finally {
    descongelar();
  }
  const saida = document.createElement("canvas");
  saida.width = recorte.largura;
  saida.height = recorte.altura;
  const ctx = saida.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não permitiu gerar a imagem.");
  ctx.drawImage(imagem, recorte.x, recorte.y, recorte.largura, recorte.altura, 0, 0, recorte.largura, recorte.altura);

  let url = saida.toDataURL("image/png");
  let mime = "image/png";
  if (url.length * 0.75 > MAX_BYTES_PNG) {
    url = saida.toDataURL("image/jpeg", 0.85);
    mime = "image/jpeg";
  }
  return { base64: url.replace(/^data:[^;]+;base64,/, ""), mime };
}

/**
 * Print delimitado para a Lugia: a pessoa marca uma área de qualquer tela do app e o recorte vai como anexo
 * para o chat. Também guarda a conversa e o rascunho do chat enquanto ela navega até a tela.
 */
export default function CapturaLugiaProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [estado, setEstado] = useState<EstadoCaptura>("inativo");
  const [prints, setPrints] = useState<PrintPendente[]>([]);
  const [sessao, setSessao] = useState<SessaoLugia>({ idConversa: null, rascunho: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [selecao, setSelecao] = useState<Retangulo | null>(null);
  const filaRef = useRef<PrintPendente[]>([]);
  const destinoRef = useRef("/lugia");

  const cancelar = useCallback(() => {
    setEstado("inativo");
    setInicio(null);
    setSelecao(null);
  }, []);

  const iniciar = useCallback((modo: "agora" | "escolher", destino = "/lugia") => {
    destinoRef.current = destino;
    setErro(null);
    setSelecao(null);
    setEstado(modo === "agora" ? "selecionando" : "navegando");
  }, []);

  useEffect(() => {
    if (estado !== "selecionando" && estado !== "navegando") return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cancelar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [estado, cancelar]);

  useEffect(() => {
    if (!erro) return;
    const t = window.setTimeout(() => setErro(null), 5000);
    return () => window.clearTimeout(t);
  }, [erro]);

  const concluir = async (area: Retangulo) => {
    setEstado("capturando");
    await proximoQuadro(); // tira o retângulo da frente antes de renderizar
    try {
      const { base64, mime } = await capturar(area);
      const tela = location.pathname;
      const destino = destinoRef.current;
      const print: PrintPendente = { nome: nomePrint(tela, new Date()).replace(/\.png$/, mime === "image/png" ? ".png" : ".jpg"), mime, base64, tela, destino };
      filaRef.current = [...filaRef.current, print];
      setPrints(filaRef.current);
      setEstado("inativo");
      setSelecao(null);
      destinoRef.current = "/lugia";
      navigate(destino);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível capturar a tela.");
      setEstado("inativo");
      setSelecao(null);
    }
  };

  const aoApertar = (e: EventoPonteiro<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setInicio({ x: e.clientX, y: e.clientY });
    setSelecao({ x: e.clientX, y: e.clientY, largura: 0, altura: 0 });
  };
  const aoMover = (e: EventoPonteiro<HTMLDivElement>) => {
    if (inicio) setSelecao(retanguloEntre(inicio.x, inicio.y, e.clientX, e.clientY));
  };
  const aoSoltar = (e: EventoPonteiro<HTMLDivElement>) => {
    if (!inicio) return;
    const area = retanguloEntre(inicio.x, inicio.y, e.clientX, e.clientY);
    setInicio(null);
    if (selecaoValida(area)) void concluir(area);
    else setSelecao(null);
  };

  const consumirPrints = useCallback((destino = "/lugia") => {
    const deles = filaRef.current.filter(p => p.destino === destino);
    if (!deles.length) return deles;
    filaRef.current = filaRef.current.filter(p => p.destino !== destino);
    setPrints(filaRef.current);
    return deles;
  }, []);

  // Estável e sem re-render quando nada muda: a tela da Lugia chama a cada tecla.
  const atualizarSessao = useCallback((parcial: Partial<SessaoLugia>) => {
    setSessao(atual => {
      const nova = { ...atual, ...parcial };
      return nova.idConversa === atual.idConversa && nova.rascunho === atual.rascunho ? atual : nova;
    });
  }, []);

  const valor = useMemo<CapturaLugia>(
    () => ({ estado, iniciar, cancelar, prints, consumirPrints, sessao, atualizarSessao }),
    [estado, iniciar, cancelar, prints, consumirPrints, sessao, atualizarSessao],
  );

  return (
    <ContextoCapturaLugia.Provider value={valor}>
      {children}

      {estado === "navegando" && (
        <div {...{ [ATRIBUTO_SEM_PRINT]: "" }} role="status"
          className="fixed inset-x-3 bottom-4 z-[60] mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-surgir sm:inset-x-0">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
            <Camera className="h-4 w-4 shrink-0 text-blue-600" />
            <span>Abra a tela que quer mostrar e toque em <strong>Capturar</strong>.</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={cancelar} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={() => iniciar("agora", destinoRef.current)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Capturar</button>
          </div>
        </div>
      )}

      {estado === "selecionando" && (
        <div {...{ [ATRIBUTO_SEM_PRINT]: "" }} className="fixed inset-0 z-[80] cursor-crosshair touch-none select-none"
          onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar}
          role="dialog" aria-modal="true" aria-label="Marque a área do print">
          {!selecao || selecao.largura === 0 ? <div className="absolute inset-0 bg-slate-900/30" /> : (
            <div className="absolute border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
              style={{ left: selecao.x, top: selecao.y, width: selecao.largura, height: selecao.altura }} />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-3">
            <p className="rounded-xl bg-slate-900/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              Arraste para marcar a área do print · Esc cancela
            </p>
          </div>
          <button type="button" onPointerDown={e => e.stopPropagation()} onClick={cancelar} aria-label="Cancelar print"
            className="absolute right-4 top-4 rounded-xl bg-white p-2 text-slate-600 shadow-lg hover:text-red-600">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {estado === "capturando" && (
        <div {...{ [ATRIBUTO_SEM_PRINT]: "" }} role="status" className="fixed inset-x-0 bottom-6 z-[80] flex justify-center">
          <p className="flex items-center gap-2 rounded-xl bg-slate-900/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando o print…
          </p>
        </div>
      )}

      {erro && (
        <p {...{ [ATRIBUTO_SEM_PRINT]: "" }} role="alert"
          className="fixed inset-x-3 bottom-4 z-[80] mx-auto max-w-md rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700 shadow-lg sm:inset-x-0">
          {erro}
        </p>
      )}
    </ContextoCapturaLugia.Provider>
  );
}
