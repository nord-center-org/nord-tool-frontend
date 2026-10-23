import "@fontsource/press-start-2p/latin-400.css";
import "./davi.css";

const CORES = ["#f472b6", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa"];

/** Título em fonte pixelada: letras coloridas com sombra em degraus, pulando em onda. */
export default function TituloPixel({ texto, tamanho = "text-lg sm:text-2xl md:text-3xl", className = "" }: { texto: string; tamanho?: string; className?: string }) {
  let n = 0;
  return (
    <h1 className={`font-['Press_Start_2P'] leading-[1.5] tracking-tight ${tamanho} ${className}`} aria-label={texto}>
      {texto.split(" ").map((palavra, i) => (
        <span key={i} className="mr-[0.5em] inline-block whitespace-nowrap last:mr-0" aria-hidden="true">
          {[...palavra].map((letra, j) => {
            const k = n++;
            return (
              <span key={j} className="nt-letra-pixel inline-block" style={{ color: CORES[k % CORES.length], animationDelay: `${k * 70}ms` }}>{letra}</span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
