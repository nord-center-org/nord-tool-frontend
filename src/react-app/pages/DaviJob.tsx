import { useState } from "react";
import "./DaviJob.css";
import KawaiiCatSvg from "@/react-app/components/davi/KawaiiCatSvg";

const tarefasDaSemana = [
  { dia: "Segunda-feira", tarefa: "Revisar prioridades" },
  { dia: "Terça-feira", tarefa: "Acompanhar demandas" },
  { dia: "Quarta-feira", tarefa: "Atualizar pendências" },
  { dia: "Quinta-feira", tarefa: "Organizar entregas" },
  { dia: "Sexta-feira", tarefa: "Concluir atividades" },
  { dia: "Sábado", tarefa: "Planejar a semana" },
  { dia: "Domingo", tarefa: "Descanso" },
];

interface KawaiiCatProps {
  variant: "calico" | "grey" | "ginger";
  onClick?: () => void;
  activeAction?: "jump" | "flip" | "wiggle" | null;
  bubbleText?: string | null;
  name: string;
}

function KawaiiCat({ variant, onClick, activeAction, bubbleText, name }: KawaiiCatProps) {
  let positionClass = "kawaii-cat-corner--right";
  if (variant === "grey") positionClass = "kawaii-cat-corner--left";
  if (variant === "ginger") positionClass = "kawaii-cat-corner--center";

  let actionClass = "";
  if (activeAction === "jump") actionClass = "cat-action-jump";
  if (activeAction === "flip") actionClass = "cat-action-flip";
  if (activeAction === "wiggle") actionClass = "cat-action-wiggle";

  return (
    <div
      className={`kawaii-cat-container ${positionClass} ${actionClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`Clique no ${name}!`}
    >
      {/* Speech / Sound Bubble */}
      {bubbleText && (
        <div className="cat-speech-bubble">
          <span>{bubbleText}</span>
        </div>
      )}

      {/* Floating Particles */}
      {activeAction && (
        <div className="cat-particles" aria-hidden="true">
          <span className="particle p1">{variant === "grey" ? "✨" : variant === "ginger" ? "🐾" : "💕"}</span>
          <span className="particle p2">{variant === "grey" ? "🌟" : variant === "ginger" ? "⭐" : "💖"}</span>
          <span className="particle p3">{variant === "grey" ? "✨" : variant === "ginger" ? "🐾" : "💗"}</span>
        </div>
      )}

      <KawaiiCatSvg variant={variant} />
    </div>
  );
}

export default function DaviJobPage() {
  const [activeCat, setActiveCat] = useState<{
    id: string;
    action: "jump" | "flip" | "wiggle";
    bubble: string;
  } | null>(null);
  const [ballSide, setBallSide] = useState<"left" | "right">("left");
  const [isBallFlying, setIsBallFlying] = useState(false);

  const handleCatClick = (id: string, action: "jump" | "flip" | "wiggle", bubble: string) => {
    setActiveCat({ id, action, bubble });
    setTimeout(() => {
      setActiveCat((prev) => (prev?.id === id ? null : prev));
    }, 1800);
  };

  const spawnFlyingBall = () => {
    if (isBallFlying) return;
    setIsBallFlying(true);
  };

  const finishBallFlight = () => {
    setBallSide((currentSide) => (currentSide === "left" ? "right" : "left"));
    setIsBallFlying(false);
  };

  return (
    <div onClick={spawnFlyingBall}>
      <h1 className="mb-8 text-3xl font-bold text-slate-800">Davi Job</h1>

      <span
        className={`flying-yarn-ball yarn-ball--${ballSide}${
          isBallFlying ? ` yarn-ball--flying-${ballSide === "left" ? "right" : "left"}` : ""
        }`}
        onAnimationEnd={finishBallFlight}
        aria-hidden="true"
      />

      <div className="davi-job-table-stage">
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">
                    Dia da semana
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">
                    Tarefas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tarefasDaSemana.map(({ dia, tarefa }) => (
                  <tr key={dia} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{dia}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{tarefa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <KawaiiCat
        name="Gatinho Calico"
        variant="calico"
        onClick={() => handleCatClick("cat1", "jump", "Miau! 💕")}
        activeAction={activeCat?.id === "cat1" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat1" ? activeCat.bubble : null}
      />
      <KawaiiCat
        name="Gatinho Cinza de Coleira"
        variant="grey"
        onClick={() => handleCatClick("cat2", "flip", "Purr~ 🌟")}
        activeAction={activeCat?.id === "cat2" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat2" ? activeCat.bubble : null}
      />
      <KawaiiCat
        name="Gatinho Laranja"
        variant="ginger"
        onClick={() => handleCatClick("cat3", "wiggle", "Nyaa! 🐾")}
        activeAction={activeCat?.id === "cat3" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat3" ? activeCat.bubble : null}
      />
    </div>
  );
}
