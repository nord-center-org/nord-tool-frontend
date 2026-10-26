import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import "@fontsource/press-start-2p/latin-400.css";
import "./LugiaNexus.css";

import imgAnunciando from "@/react-app/assets/lugia-nexus/anunciando.webp";
import imgNotebook from "@/react-app/assets/lugia-nexus/notebook.webp";
import imgParado from "@/react-app/assets/lugia-nexus/parado.webp";
import { useAuth } from "@/react-app/hooks/useAuth";
import { dataCurta, lerUltimaVista, marcarVista, naoVistas, NOVIDADES, type Novidade } from "@/react-app/utils/novidades";
import { podeAbrirRota } from "@/react-app/utils/sessao";
import { jaViuTutorial } from "@/react-app/utils/tutorial";
import { ESPIADA_MS, VISITA_MS, falaDaEspiada, intervaloEspiada, ladoDaEspiada, type LadoEspiada } from "@/react-app/utils/nexus";

const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);
const PIXEL = "font-['Press_Start_2P'] leading-[1.6]";

const semAnimacao = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Texto surgindo letra a letra, como diálogo de jogo; com movimento reduzido aparece inteiro. */
function useDigitacao(texto: string, ativo: boolean): string {
  const [n, setN] = useState(ativo && !semAnimacao() ? 0 : texto.length);
  useEffect(() => {
    if (!ativo || semAnimacao()) {
      setN(texto.length);
      return;
    }
    setN(0);
    const relogio = window.setInterval(() => setN(v => (v >= texto.length ? v : v + 2)), 22);
    return () => window.clearInterval(relogio);
  }, [texto, ativo]);
  return texto.slice(0, n);
}

/** fora: escondido (só o botãozinho); presente: na tela; espiando: só a cabeça para fora do canto. */
type Fase = "fora" | "presente" | "espiando";

/**
 * Lugia Nexus: mascote no canto da tela inicial que conta as últimas atualizações do NordTool.
 * Com novidade que a pessoa ainda não viu (depois do tour inicial), aparece já com o balão. Sem novidade,
 * dá uma passadinha e vai embora. Escondido, de vez em quando espia pelo canto e volta se ninguém clicar;
 * enquanto isso fica um botãozinho no canto para chamá-lo.
 */
export default function LugiaNexus() {
  const { usuario } = useAuth();
  const [pendentes, setPendentes] = useState<Novidade[]>([]);
  const [aberto, setAberto] = useState(false);
  const [anunciando, setAnunciando] = useState(false);
  const [fase, setFase] = useState<Fase>("fora");
  const [lado, setLado] = useState<LadoEspiada>("lado");
  const [fala, setFala] = useState("");
  const [mouseEmCima, setMouseEmCima] = useState(false);
  const refMascote = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!usuario) return;
    const novas = naoVistas(NOVIDADES, lerUltimaVista(armazenamento(), usuario.id));
    setPendentes(novas);
    // No primeiro acesso o tour do NordTool abre na tela inicial; o mascote espera a próxima visita.
    if (!jaViuTutorial(armazenamento(), usuario.id)) return;
    const timers: number[] = [];
    // Entra um instante depois da tela, acenando.
    timers.push(window.setTimeout(() => {
      setFase("presente");
      setAnunciando(true);
      if (novas.length > 0) setAberto(true);
    }, 700));
    timers.push(window.setTimeout(() => setAnunciando(false), 3300));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [usuario]);

  // Na tela sem o balão aberto: fica um pouco e vai embora (com o mouse em cima, espera).
  useEffect(() => {
    if (fase !== "presente" || aberto || mouseEmCima) return;
    const t = window.setTimeout(() => setFase("fora"), VISITA_MS);
    return () => window.clearTimeout(t);
  }, [fase, aberto, mouseEmCima]);

  // Escondido: de vez em quando espia pelo canto; sem clique, volta a se esconder.
  useEffect(() => {
    if (!usuario || semAnimacao()) return;
    if (fase === "fora" && !aberto) {
      const t = window.setTimeout(() => {
        setLado(ladoDaEspiada(Math.random));
        setFala(falaDaEspiada(Math.random));
        setFase("espiando");
      }, intervaloEspiada(Math.random));
      return () => window.clearTimeout(t);
    }
    if (fase === "espiando" && !mouseEmCima) {
      const t = window.setTimeout(() => setFase("fora"), ESPIADA_MS);
      return () => window.clearTimeout(t);
    }
  }, [usuario, fase, aberto, mouseEmCima]);

  const historico = pendentes.length === 0;
  const mostrando = historico ? NOVIDADES.slice(0, 3) : pendentes;
  const principal = mostrando[0];
  const digitado = useDigitacao(principal?.texto ?? "", aberto && !historico);

  if (!usuario || !principal) return null;

  const fechar = () => {
    marcarVista(armazenamento(), usuario.id, NOVIDADES[0].id);
    setPendentes([]);
    setAberto(false);
    setFase("fora");
  };
  const chamar = () => {
    setFase("presente");
    setAberto(true);
    setAnunciando(true);
    window.setTimeout(() => setAnunciando(false), 1600);
    window.setTimeout(() => refMascote.current?.focus({ preventScroll: true }), 50);
  };

  const imagem = anunciando ? imgAnunciando : aberto && historico ? imgNotebook : imgParado;
  const terminou = digitado.length >= principal.texto.length;

  const onde = (n: Novidade) =>
    n.onde && (podeAbrirRota(usuario.permissoes, n.onde.caminho) ? (
      <Link to={n.onde.caminho} onClick={fechar}
        className={`nt-nexus-botao inline-block shrink-0 bg-amber-300 px-2.5 py-1.5 text-[9px] text-slate-900 hover:bg-amber-200 ${PIXEL}`}>
        Ver ▶
      </Link>
    ) : (
      <span className="text-xs text-slate-500">Peça acesso ao administrador.</span>
    ));

  return (
    <>
    <div data-sem-print className="pointer-events-none fixed bottom-3 right-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-col items-end sm:bottom-5 sm:right-5">
      {aberto && fase === "presente" && (
        <section role="status" aria-label="Novidades do NordTool" className="pointer-events-auto relative mb-5 mr-1 w-80 max-w-[calc(100vw-2.5rem)] animate-surgir">
          <div className="nt-nexus-caixa relative px-4 pb-4 pt-6">
            <span className={`nt-nexus-rotulo absolute -top-3 left-3 px-2 py-1 text-[9px] ${PIXEL}`}>Lugia Nexus</span>
            <button type="button" onClick={fechar} aria-label="Fechar novidades"
              className={`absolute right-2 top-2 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-900 ${PIXEL}`}>
              X
            </button>

            <p className={`text-[9px] uppercase text-blue-700 ${PIXEL}`}>
              {historico ? "Últimas atualizações" : pendentes.length > 1 ? `${pendentes.length} novidades!` : "Novidade!"}
            </p>

            <div className="mt-3">
              <p className={`text-[10px] text-slate-900 ${PIXEL}`}>{principal.titulo}</p>
              <p className="mt-2 min-h-[4.5rem] text-sm leading-snug text-slate-700" aria-label={principal.texto}>
                <span aria-hidden="true">{digitado}</span>
                {!terminou && <span aria-hidden="true" className="nt-nexus-cursor ml-0.5 inline-block h-3 w-2 bg-slate-700 align-middle" />}
              </p>
              {principal.onde && <p className="mt-1 text-xs font-semibold text-slate-500">Onde: {principal.onde.rotulo}</p>}
            </div>

            {mostrando.length > 1 && (
              <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t-4 border-dotted border-blue-200 pt-3">
                {mostrando.slice(1).map(n => (
                  <li key={n.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{n.titulo}</p>
                      <p className={`text-[8px] text-slate-400 ${PIXEL}`}>{dataCurta(n.data)}</p>
                    </div>
                    {onde(n)}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className={`text-[8px] text-slate-400 ${PIXEL}`}>{dataCurta(principal.data)}</span>
              <div className="flex items-center gap-3">
                {onde(principal)}
                {!historico && (
                  <button type="button" onClick={fechar}
                    className={`nt-nexus-botao bg-blue-600 px-2.5 py-1.5 text-[9px] text-white hover:bg-blue-500 ${PIXEL}`}>
                    OK!
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Rabinho do balão em degraus, apontando para o mascote */}
          <span aria-hidden="true" className="absolute -bottom-[10px] right-10 block h-1.5 w-4 bg-[#1e2963]" />
          <span aria-hidden="true" className="absolute -bottom-[16px] right-11 block h-1.5 w-2 bg-[#1e2963]" />
        </section>
      )}
      <button ref={refMascote} type="button" onClick={() => (aberto ? fechar() : chamar())}
        onMouseEnter={() => { setMouseEmCima(true); if (fase === "presente") setAnunciando(true); }}
        onMouseLeave={() => { setMouseEmCima(false); setAnunciando(false); }}
        aria-label={aberto ? "Fechar novidades do Lugia Nexus" : "Ver as últimas atualizações com o Lugia Nexus"} aria-expanded={aberto}
        aria-hidden={fase === "fora"} tabIndex={fase === "fora" ? -1 : 0}
        className={`nt-nexus-mascote relative p-1 ${fase === "fora" ? "nt-nexus-fora" : fase === "espiando" ? `nt-nexus-espiando nt-nexus-espiando-${lado} pointer-events-auto` : "pointer-events-auto"}`}>
        <img src={imagem} alt="" width={75} height={88} draggable={false}
          className="h-[72px] w-auto select-none animate-flutuar drop-shadow-[0_6px_10px_rgba(37,99,235,0.35)] sm:h-[88px]" />
        {fase === "espiando" && (
          <span aria-hidden="true" className={`nt-nexus-psiu nt-nexus-rotulo absolute px-1.5 py-1 text-[8px] ${PIXEL}`}>{fala}</span>
        )}
      </button>
    </div>
    {fase !== "presente" && (
      <button type="button" onClick={chamar} data-sem-print aria-label="Chamar o Lugia Nexus (últimas atualizações)" title="Lugia Nexus"
        className={`nt-nexus-mini fixed bottom-3 right-3 z-30 flex h-10 w-10 items-center justify-center overflow-hidden bg-[#f4f8ff] sm:bottom-5 sm:right-5 ${fase === "espiando" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <img src={imgParado} alt="" width={73} height={88} draggable={false} className="h-[54px] w-auto max-w-none translate-y-[9px] select-none" />
        {pendentes.length > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2.5 w-2.5 bg-red-500 shadow-[0_0_0_2px_#1e2963]" />}
      </button>
    )}
    </>
  );
}
