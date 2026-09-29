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
  className?: string;
}

function BolinhoCorner({ variant, onClick, className: customClassName }: BolinhoCornerProps) {
  let defaultClassName = "bolinho-pet";
  if (variant === "second") defaultClassName = "bolinho-pet bolinho-pet--second";
  if (variant === "third") defaultClassName = "bolinho-pet bolinho-pet--third";

  const className = customClassName || defaultClassName;

  return (
    <div className={className} aria-hidden="true" onClick={onClick} style={{ cursor: "pointer" }}>
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
  const [clickedCat, setClickedCat] = useState<string | null>(null);

  function handleCatClick(variant: string | null) {
    setClickedCat(variant);
    // Reset after animation completes
    setTimeout(() => setClickedCat(null), 4000);
  }

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
        onClick={() => handleCatClick("right")}
        className={clickedCat === "right" ? "bolinho-pet cat-hide" : "bolinho-pet"}
      />
      <BolinhoCorner
        variant="second"
        onClick={() => handleCatClick("second")}
        className={
          clickedCat === "second"
            ? "bolinho-pet bolinho-pet--second cat-jump"
            : "bolinho-pet bolinho-pet--second"
        }
      />
      <BolinhoCorner
        variant="third"
        onClick={() => handleCatClick("third")}
        className={
          clickedCat === "third"
            ? "bolinho-pet bolinho-pet--third cat-run"
            : "bolinho-pet bolinho-pet--third"
        }
      />
    </div>
  );
}
