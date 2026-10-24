import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, HardHat, X } from "lucide-react";

import {
  alvosDoPasso, contemTexto, posicionarBalao,
  type AlvoTutorial, type PassoTutorial, type Retangulo, type Tutorial as DadosTutorial,
} from "@/react-app/utils/tutorial";

interface TutorialProps {
  tutorial: DadosTutorial;
  /** Onde procurar os alvos primeiro (a tela aberta); depois procura na página toda. */
  raiz?: () => ParentNode | null;
  /** Antes de cada passo: abre/fecha o menu, abre o grupo… */
  onPasso?: (passo: PassoTutorial) => void;
  onFechar: () => void;
}

const FOLGA = 6;
const ESPERA_ALVO_MS = 900;

const visivel = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const conferir = (el as HTMLElement & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  return conferir ? conferir.call(el, { opacityProperty: true, visibilityProperty: true }) : true;
};

function acharAlvo(alvos: AlvoTutorial[], raiz: ParentNode | null): HTMLElement | null {
  for (const alvo of alvos) {
    for (const base of raiz ? [raiz, document] : [document]) {
      const achados = Array.from(base.querySelectorAll<HTMLElement>(alvo.css))
        .filter(el => !el.closest("[data-tutorial-balao]") && visivel(el) && (!alvo.texto || contemTexto(el.textContent, alvo.texto)));
      // Com texto, vale o elemento mais "justo" (o de menos texto), não um contêiner enorme.
      const el = alvo.texto ? achados.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] : achados[0];
      if (!el) continue;
      let destino: HTMLElement = el;
      for (let n = 0; n < (alvo.pai ?? 0) && destino.parentElement; n++) destino = destino.parentElement;
      return destino;
    }
  }
  return null;
}

const retangulo = (el: HTMLElement): Retangulo => {
  const r = el.getBoundingClientRect();
  return { x: r.left - FOLGA, y: r.top - FOLGA, largura: r.width + FOLGA * 2, altura: r.height + FOLGA * 2 };
};

const mesmoRetangulo = (a: Retangulo | null, b: Retangulo | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.largura - b.largura) < 0.5 && Math.abs(a.altura - b.altura) < 0.5);

/** Tour em balõezinhos por cima da tela: escurece tudo, destaca o alvo do passo e explica. */
export default function Tutorial({ tutorial, raiz, onPasso, onFechar }: TutorialProps) {
  const { passos } = tutorial;
  const [i, setI] = useState(0);
  const direcao = useRef<1 | -1>(1);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [procurando, setProcurando] = useState(true);
  const [tela, setTela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  const [balao, setBalao] = useState({ largura: 320, altura: 220 });
  const refBalao = useRef<HTMLDivElement>(null);
  const refProximo = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();
  const passo = passos[i];

  const ir = useCallback((d: 1 | -1) => {
    direcao.current = d;
    setI(v => Math.min(passos.length - 1, Math.max(0, v + d)));
  }, [passos.length]);

  // Cada passo: prepara a tela, procura o alvo (pulando o que não existe) e acompanha onde ele está.
  useEffect(() => {
    if (!passo) return;
    onPasso?.(passo);
    const alvos = alvosDoPasso(passo);
    setProcurando(alvos.length > 0);
    if (alvos.length === 0) { setAlvo(null); return; }
    const inicio = performance.now();
    let el: HTMLElement | null = null;
    let rolou = false;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      // Procura de novo a cada volta: o alvo preferido pode aparecer depois (menu abrindo, lista carregando).
      el = acharAlvo(alvos, raiz?.() ?? null);
      if (!el) {
        if (performance.now() - inicio > ESPERA_ALVO_MS) {
          window.clearInterval(t);
          // Alvo que não existe para esta pessoa (sem permissão, lista vazia…): segue para o próximo.
          const proximo = i + direcao.current;
          if (proximo >= passos.length) onFechar();
          else if (proximo < 0) { direcao.current = 1; setI(i + 1); }
          else setI(proximo);
        }
        return;
      }
      if (!rolou) {
        rolou = true;
        const r = el.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center", behavior: reduzido ? "auto" : "smooth" });
      }
      const novo = retangulo(el);
      setProcurando(false);
      setAlvo(atual => (mesmoRetangulo(atual, novo) ? atual : novo));
    };
    tick();
    const t = window.setInterval(tick, 100);
    return () => window.clearInterval(t);
  }, [i, passo, passos.length, raiz, onPasso, onFechar]);

  useEffect(() => {
    const medir = () => setTela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // O tamanho real do balão (muda com o texto de cada passo) decide onde ele cabe.
  useLayoutEffect(() => {
    const el = refBalao.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setBalao(atual => (Math.abs(r.width - atual.largura) > 1 || Math.abs(r.height - atual.altura) > 1 ? { largura: r.width, altura: r.height } : atual));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { if (!procurando) refProximo.current?.focus({ preventScroll: true }); }, [i, procurando]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onFechar(); }
      if (e.key === "ArrowRight") { e.preventDefault(); if (i < passos.length - 1) ir(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); ir(-1); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [i, ir, onFechar, passos.length]);

  if (!passo) return null;
  const pos = posicionarBalao(alvo, tela, balao);
  const ultimo = i === passos.length - 1;
  // Setinha do balão apontando para o centro do alvo.
  const setaX = alvo ? Math.min(Math.max(alvo.x + alvo.largura / 2 - pos.x, 20), balao.largura - 20) : 0;

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Bloqueia cliques na tela enquanto o tour está aberto. */}
      <div className="absolute inset-0" aria-hidden="true" />
      {alvo ? (
        <div aria-hidden="true" className="nt-tutorial-foco pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out"
          style={{ left: alvo.x, top: alvo.y, width: alvo.largura, height: alvo.altura, boxShadow: "0 0 0 3px rgba(96, 165, 250, 0.95), 0 0 24px 4px rgba(96, 165, 250, 0.35), 0 0 0 9999px rgba(15, 23, 42, 0.62)" }} />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-900/60 animate-aparecer" />
      )}

      <div ref={refBalao} data-tutorial-balao role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        className={`absolute w-[min(22rem,calc(100vw-24px))] transition-[left,top,opacity] duration-300 ease-out ${procurando ? "opacity-0" : "opacity-100"}`}
        style={{ left: pos.x, top: pos.y }}>
        {(pos.lado === "baixo" || pos.lado === "cima") && (
          <span aria-hidden="true" className={`absolute h-4 w-4 rotate-45 border-slate-200 bg-white ${pos.lado === "baixo" ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r"}`}
            style={{ left: setaX - 8 }} />
        )}
        <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-2xl animate-surgir">
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white">
            <span className="nt-tutorial-mascote flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20"><HardHat className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/75">{tutorial.titulo}</p>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {passos.map((_, n) => (
                  <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-5 bg-white" : n < i ? "w-1.5 bg-white/80" : "w-1.5 bg-white/30"}`} />
                ))}
              </div>
            </div>
            <button type="button" onClick={onFechar} aria-label="Fechar tutorial" className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto px-4 pb-1 pt-3" aria-live="polite">
            <h2 id={idTitulo} className="text-base font-black text-slate-900">{passo.titulo}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{passo.texto}</p>
            {passo.lista && passo.lista.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {passo.lista.map((item, n) => (
                  <li key={item.nome} className="nt-tutorial-item rounded-xl bg-slate-50 px-3 py-2 text-xs leading-snug" style={{ animationDelay: `${120 + n * 70}ms` }}>
                    <strong className="block text-sm text-slate-800">{item.nome}</strong>
                    {item.texto}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
            <span className="text-xs font-semibold text-slate-400">{i + 1} de {passos.length}</span>
            <div className="flex items-center gap-1.5">
              {!ultimo && <button type="button" onClick={onFechar} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600">Pular</button>}
              <button type="button" onClick={() => ir(-1)} disabled={i === 0} aria-label="Passo anterior"
                className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button ref={refProximo} type="button" onClick={() => (ultimo ? onFechar() : ir(1))}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.97]">
                {ultimo ? "Concluir" : <>Próximo <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
