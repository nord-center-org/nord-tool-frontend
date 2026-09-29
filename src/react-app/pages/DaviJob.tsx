import { useState } from "react";
import "./DaviJob.css";

const tarefasDaSemana = [
  { dia: "Segunda-feira", tarefa: "Revisar prioridades" },
  { dia: "Terça-feira", tarefa: "Acompanhar demandas" },
  { dia: "Quarta-feira", tarefa: "Atualizar pendências" },
  { dia: "Quinta-feira", tarefa: "Organizar entregas" },
  { dia: "Sexta-feira", tarefa: "Concluir atividades" },
  { dia: "Sábado", tarefa: "Planejar a semana" },
  { dia: "Domingo", tarefa: "Descanso" },
];

interface BolinhoCornerProps {
  variant?: "second" | "third";
  onClick?: () => void;
  activeAction?: "jump" | "flip" | "wiggle" | null;
  bubbleText?: string | null;
  name: string;
}

function BolinhoCorner({ variant, onClick, activeAction, bubbleText, name }: BolinhoCornerProps) {
  let variantClass = "";
  if (variant === "second") variantClass = "bolinho-pet--second";
  if (variant === "third") variantClass = "bolinho-pet--third";

  let actionClass = "";
  if (activeAction === "jump") actionClass = "cat-action-jump";
  if (activeAction === "flip") actionClass = "cat-action-flip";
  if (activeAction === "wiggle") actionClass = "cat-action-wiggle";

  return (
    <div
      className={`bolinho-pet ${variantClass} ${actionClass}`}
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
          <span className="particle p1">{variant === "second" ? "✨" : variant === "third" ? "🐾" : "💕"}</span>
          <span className="particle p2">{variant === "second" ? "🌟" : variant === "third" ? "⭐" : "💖"}</span>
          <span className="particle p3">{variant === "second" ? "✨" : variant === "third" ? "🐾" : "💗"}</span>
        </div>
      )}

      <span className="bolinho-pet__thread" />
      <span className="bolinho-pet__yarn" />
      <svg className="bolinho-pet__sprite" viewBox="0 0 64 48" role="presentation">
        <g className="bolinho-pet__tail">
          <rect x="47" y="27" width="8" height="5" fill="#6d4936" />
          <rect x="53" y="22" width="5" height="8" fill="#6d4936" />
          <rect x="57" y="18" width="4" height="7" fill="#6d4936" />
          <rect x="58" y="17" width="4" height="3" fill="#edcfaa" />
        </g>
        <rect x="16" y="24" width="35" height="15" fill="#6d4936" />
        <rect x="18" y="22" width="29" height="18" fill="#edcfaa" />
        <rect className="bolinho-pet__leg bolinho-pet__leg--back" x="19" y="38" width="10" height="4" fill="#6d4936" />
        <rect className="bolinho-pet__leg bolinho-pet__leg--front" x="31" y="38" width="10" height="4" fill="#6d4936" />
        <rect className="bolinho-pet__leg bolinho-pet__leg--back" x="20" y="37" width="9" height="4" fill="#f7dfbc" />
        <rect className="bolinho-pet__leg bolinho-pet__leg--front" x="32" y="37" width="9" height="4" fill="#f7dfbc" />
        <rect x="13" y="8" width="5" height="12" fill="#6d4936" />
        <rect x="17" y="11" width="32" height="20" fill="#6d4936" />
        <rect className="bolinho-pet__ear" x="20" y="6" width="8" height="8" fill="#6d4936" />
        <rect className="bolinho-pet__ear" x="39" y="6" width="8" height="8" fill="#6d4936" />
        <rect x="18" y="12" width="30" height="18" fill="#edcfaa" />
        <rect x="21" y="10" width="6" height="5" fill="#f2a1a5" />
        <rect x="40" y="10" width="6" height="5" fill="#f2a1a5" />
        <rect x="23" y="18" width="7" height="7" fill="#754426" />
        <rect x="37" y="18" width="7" height="7" fill="#754426" />
        <rect className="bolinho-pet__blink" x="23" y="21" width="7" height="2" fill="#2a1b17" />
        <rect className="bolinho-pet__blink" x="37" y="21" width="7" height="2" fill="#2a1b17" />
        <rect x="25" y="19" width="2" height="2" fill="#fff" />
        <rect x="39" y="19" width="2" height="2" fill="#fff" />
        <rect x="32" y="25" width="4" height="3" fill="#e88596" />
        <rect x="31" y="28" width="2" height="2" fill="#6d4936" />
        <rect x="35" y="28" width="2" height="2" fill="#6d4936" />
        <rect className="bolinho-pet__paw" x="13" y="34" width="10" height="5" fill="#edcfaa" />
      </svg>
    </div>
  );
}

export default function DaviJobPage() {
  const [activeCat, setActiveCat] = useState<{
    id: string;
    action: "jump" | "flip" | "wiggle";
    bubble: string;
  } | null>(null);

  const handleCatClick = (id: string, action: "jump" | "flip" | "wiggle", bubble: string) => {
    setActiveCat({ id, action, bubble });
    setTimeout(() => {
      setActiveCat((prev) => (prev?.id === id ? null : prev));
    }, 1800);
  };

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-slate-800">Davi Job</h1>

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

      <BolinhoCorner
        name="Bolinho Calico"
        onClick={() => handleCatClick("cat1", "jump", "Miau! 💕")}
        activeAction={activeCat?.id === "cat1" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat1" ? activeCat.bubble : null}
      />
      <BolinhoCorner
        name="Bolinho Azul"
        variant="second"
        onClick={() => handleCatClick("cat2", "flip", "Purr~ 🌟")}
        activeAction={activeCat?.id === "cat2" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat2" ? activeCat.bubble : null}
      />
      <BolinhoCorner
        name="Bolinho Laranja"
        variant="third"
        onClick={() => handleCatClick("cat3", "wiggle", "Nyaa! 🐾")}
        activeAction={activeCat?.id === "cat3" ? activeCat.action : null}
        bubbleText={activeCat?.id === "cat3" ? activeCat.bubble : null}
      />
    </div>
  );
}
