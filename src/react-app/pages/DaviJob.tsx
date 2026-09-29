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

interface KawaiiCatProps {
  variant: "calico" | "grey" | "ginger";
  onClick?: () => void;
  activeAction?: "jump" | "flip" | "wiggle" | null;
  bubbleText?: string | null;
  name: string;
}

function KawaiiCatSvg({ variant }: { variant: "calico" | "grey" | "ginger" }) {
  if (variant === "calico") {
    // Reference 1: Kawaii Calico Cat (Brown/White sitting cat with pink blush & tail)
    return (
      <svg viewBox="0 0 32 32" className="kawaii-cat-svg" role="presentation">
        <ellipse cx="16" cy="30" rx="10" ry="2" fill="#cbd5e1" className="kawaii-cat__shadow" />

        {/* Tail */}
        <g className="kawaii-cat__tail">
          <rect x="23" y="16" width="3" height="7" fill="#b87333" />
          <rect x="25" y="13" width="3" height="4" fill="#b87333" />
          <rect x="23" y="12" width="3" height="2" fill="#b87333" />
          <rect x="22" y="16" width="1" height="8" fill="#1f1915" />
          <rect x="28" y="13" width="1" height="4" fill="#1f1f15" />
          <rect x="25" y="12" width="3" height="1" fill="#1f1915" />
        </g>

        {/* Ears */}
        <rect x="7" y="3" width="5" height="7" fill="#b87333" />
        <rect x="8" y="5" width="3" height="4" fill="#f49ac2" />
        <rect x="20" y="3" width="5" height="7" fill="#b87333" />
        <rect x="21" y="5" width="3" height="4" fill="#f49ac2" />

        {/* Head Base */}
        <rect x="7" y="8" width="18" height="12" fill="#ffffff" />
        {/* Calico Patches */}
        <rect x="7" y="8" width="5" height="6" fill="#b87333" />
        <rect x="13" y="8" width="6" height="4" fill="#5c3a21" />
        <rect x="20" y="8" width="5" height="6" fill="#b87333" />

        {/* Eyes */}
        <rect className="kawaii-cat__eye" x="11" y="13" width="2" height="3" fill="#1f1915" />
        <rect className="kawaii-cat__eye" x="19" y="13" width="2" height="3" fill="#1f1915" />
        {/* Blush Cheeks */}
        <rect x="9" y="15" width="2" height="2" fill="#f49ac2" opacity="0.9" />
        <rect x="21" y="15" width="2" height="2" fill="#f49ac2" opacity="0.9" />
        {/* Nose & Mouth (:3) */}
        <rect x="15" y="14" width="2" height="1" fill="#1f1915" />
        <rect x="14" y="16" width="1" height="1" fill="#1f1915" />
        <rect x="15" y="16" width="2" height="1" fill="#1f1915" />
        <rect x="17" y="16" width="1" height="1" fill="#1f1915" />

        {/* Body */}
        <rect x="9" y="20" width="14" height="9" fill="#ffffff" />
        {/* Calico Body Patches */}
        <rect x="9" y="22" width="3" height="5" fill="#b87333" />
        <rect x="20" y="21" width="3" height="6" fill="#b87333" />

        {/* Front Paws */}
        <rect x="11" y="25" width="3" height="4" fill="#ffffff" />
        <rect x="18" y="25" width="3" height="4" fill="#ffffff" />
        <rect x="14" y="25" width="1" height="4" fill="#1f1915" />
        <rect x="17" y="25" width="1" height="4" fill="#1f1915" />

        {/* Pixel Outline */}
        <path
          d="M7,3 h5 v2 h-5 z M20,3 h5 v2 h-5 z M6,5 h2 v3 h-2 z M24,5 h2 v3 h-2 z M6,8 h1 v12 h-1 z M25,8 h1 v12 h-1 z M8,20 h1 v9 h-1 z M23,20 h1 v9 h-1 z M9,29 h14 v1 h-14 z"
          fill="#1f1915"
        />
      </svg>
    );
  }

  if (variant === "grey") {
    // Reference 2: Kawaii Grey Cat with Blue Collar & Yellow Bell
    return (
      <svg viewBox="0 0 32 32" className="kawaii-cat-svg" role="presentation">
        <ellipse cx="16" cy="30" rx="10" ry="2" fill="#cbd5e1" className="kawaii-cat__shadow" />

        {/* Tail (Left Side) */}
        <g className="kawaii-cat__tail">
          <rect x="5" y="17" width="3" height="7" fill="#94a3b8" />
          <rect x="3" y="14" width="3" height="4" fill="#94a3b8" />
          <rect x="4" y="12" width="3" height="3" fill="#94a3b8" />
          <rect x="4" y="17" width="1" height="8" fill="#475569" />
          <rect x="2" y="14" width="1" height="4" fill="#475569" />
          <rect x="3" y="11" width="4" height="1" fill="#475569" />
        </g>

        {/* Ears */}
        <rect x="7" y="3" width="5" height="7" fill="#94a3b8" />
        <rect x="8" y="5" width="3" height="4" fill="#cbd5e1" />
        <rect x="20" y="3" width="5" height="7" fill="#94a3b8" />
        <rect x="21" y="5" width="3" height="4" fill="#cbd5e1" />

        {/* Head Base */}
        <rect x="7" y="8" width="18" height="11" fill="#94a3b8" />
        {/* White Muzzle Area */}
        <rect x="11" y="13" width="10" height="6" fill="#f8fafc" />

        {/* Eyes */}
        <rect className="kawaii-cat__eye" x="11" y="12" width="2" height="4" fill="#0f172a" />
        <rect className="kawaii-cat__eye" x="19" y="12" width="2" height="4" fill="#0f172a" />
        {/* Nose */}
        <rect x="15" y="14" width="2" height="2" fill="#0f172a" />

        {/* Blue Collar */}
        <rect x="8" y="19" width="16" height="2" fill="#2563eb" />
        {/* Yellow Bell */}
        <rect x="15" y="20" width="2" height="2" fill="#facc15" />

        {/* Body */}
        <rect x="9" y="21" width="14" height="8" fill="#94a3b8" />
        <rect x="13" y="22" width="6" height="5" fill="#f8fafc" />

        {/* Front Paws */}
        <rect x="11" y="25" width="3" height="4" fill="#94a3b8" />
        <rect x="18" y="25" width="3" height="4" fill="#94a3b8" />
        <rect x="14" y="25" width="1" height="4" fill="#475569" />
        <rect x="17" y="25" width="1" height="4" fill="#475569" />

        {/* Outline */}
        <path
          d="M7,3 h5 v2 h-5 z M20,3 h5 v2 h-5 z M6,5 h2 v3 h-2 z M24,5 h2 v3 h-2 z M6,8 h1 v11 h-1 z M25,8 h1 v11 h-1 z M8,19 h1 v10 h-1 z M23,19 h1 v10 h-1 z M9,29 h14 v1 h-14 z"
          fill="#475569"
        />
      </svg>
    );
  }

  // Ginger / Orange Cat
  return (
    <svg viewBox="0 0 32 32" className="kawaii-cat-svg" role="presentation">
      <ellipse cx="16" cy="30" rx="10" ry="2" fill="#cbd5e1" className="kawaii-cat__shadow" />

      {/* Tail */}
      <g className="kawaii-cat__tail">
        <rect x="24" y="16" width="3" height="7" fill="#fb923c" />
        <rect x="25" y="13" width="3" height="4" fill="#c2410c" />
        <rect x="23" y="12" width="3" height="2" fill="#fb923c" />
        <rect x="23" y="16" width="1" height="8" fill="#7c2d12" />
        <rect x="28" y="13" width="1" height="4" fill="#7c2d12" />
        <rect x="23" y="11" width="4" height="1" fill="#7c2d12" />
      </g>

      {/* Ears */}
      <rect x="7" y="3" width="5" height="7" fill="#fb923c" />
      <rect x="8" y="5" width="3" height="4" fill="#fecdd3" />
      <rect x="20" y="3" width="5" height="7" fill="#fb923c" />
      <rect x="21" y="5" width="3" height="4" fill="#fecdd3" />

      {/* Head Base */}
      <rect x="7" y="8" width="18" height="12" fill="#fb923c" />
      {/* Forehead Stripes */}
      <rect x="15" y="8" width="2" height="4" fill="#ea580c" />
      <rect x="12" y="8" width="1" height="3" fill="#ea580c" />
      <rect x="19" y="8" width="1" height="3" fill="#ea580c" />
      {/* Cream Muzzle */}
      <rect x="11" y="14" width="10" height="5" fill="#fef08a" />

      {/* Eyes */}
      <rect className="kawaii-cat__eye" x="11" y="12" width="2" height="3" fill="#1c1917" />
      <rect className="kawaii-cat__eye" x="19" y="12" width="2" height="3" fill="#1c1917" />
      {/* Blush Cheeks */}
      <rect x="9" y="14" width="2" height="2" fill="#fb7185" opacity="0.85" />
      <rect x="21" y="14" width="2" height="2" fill="#fb7185" opacity="0.85" />
      {/* Nose & Mouth */}
      <rect x="15" y="14" width="2" height="1" fill="#7c2d12" />
      <rect x="14" y="16" width="1" height="1" fill="#7c2d12" />
      <rect x="15" y="16" width="2" height="1" fill="#7c2d12" />
      <rect x="17" y="16" width="1" height="1" fill="#7c2d12" />

      {/* Red Bowtie Collar */}
      <rect x="14" y="19" width="4" height="2" fill="#ef4444" />
      <rect x="13" y="19" width="1" height="1" fill="#b91c1c" />
      <rect x="18" y="19" width="1" height="1" fill="#b91c1c" />

      {/* Body */}
      <rect x="9" y="20" width="14" height="9" fill="#fb923c" />
      <rect x="12" y="21" width="8" height="6" fill="#fef08a" />

      {/* Front Paws */}
      <rect x="11" y="25" width="3" height="4" fill="#fef08a" />
      <rect x="18" y="25" width="3" height="4" fill="#fef08a" />
      <rect x="14" y="25" width="1" height="4" fill="#7c2d12" />
      <rect x="17" y="25" width="1" height="4" fill="#7c2d12" />

      {/* Outline */}
      <path
        d="M7,3 h5 v2 h-5 z M20,3 h5 v2 h-5 z M6,5 h2 v3 h-2 z M24,5 h2 v3 h-2 z M6,8 h1 v12 h-1 z M25,8 h1 v12 h-1 z M8,20 h1 v9 h-1 z M23,20 h1 v9 h-1 z M9,29 h14 v1 h-14 z"
        fill="#7c2d12"
      />
    </svg>
  );
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
  const [flyingBalls, setFlyingBalls] = useState<number[]>([]);

  const handleCatClick = (id: string, action: "jump" | "flip" | "wiggle", bubble: string) => {
    setActiveCat({ id, action, bubble });
    setTimeout(() => {
      setActiveCat((prev) => (prev?.id === id ? null : prev));
    }, 1800);
  };

  const spawnFlyingBall = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = Date.now() + Math.random();
    setFlyingBalls((prev) => [...prev, id]);
    setTimeout(() => {
      setFlyingBalls((prev) => prev.filter((ballId) => ballId !== id));
    }, 1000);
  };

  return (
    <div onClick={spawnFlyingBall}>
      <h1 className="mb-8 text-3xl font-bold text-slate-800">Davi Job</h1>

      {flyingBalls.map((id) => (
        <span key={id} className="flying-yarn-ball" aria-hidden="true" />
      ))}

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
