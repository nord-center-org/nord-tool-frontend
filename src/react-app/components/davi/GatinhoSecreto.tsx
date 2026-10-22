import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import KawaiiCatSvg from "@/react-app/components/davi/KawaiiCatSvg";
import { EVENTO_DAVI, criarDetectorPalavra, ehCampoDeTexto } from "@/react-app/utils/segredo";
import "./GatinhoSecreto.css";

const VARIANTES = ["calico", "grey", "ginger"] as const;
const DURACAO_MS = 9000;

/** Easter egg: digitar "davi" (fora de campos de texto) ou disparar EVENTO_DAVI faz um gatinho atravessar a tela. */
export default function GatinhoSecreto() {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<{ chave: number; variante: (typeof VARIANTES)[number] } | null>(null);

  useEffect(() => {
    const aparecer = () => setVisita({ chave: Date.now(), variante: VARIANTES[Math.floor(Math.random() * VARIANTES.length)] });
    const detectar = criarDetectorPalavra("davi");
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ehCampoDeTexto(e.target as HTMLElement | null)) return;
      if (detectar(e.key)) aparecer();
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener(EVENTO_DAVI, aparecer);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener(EVENTO_DAVI, aparecer);
    };
  }, []);

  useEffect(() => {
    if (!visita) return;
    const t = window.setTimeout(() => setVisita(null), DURACAO_MS);
    return () => window.clearTimeout(t);
  }, [visita]);

  if (!visita) return null;
  return (
    <button key={visita.chave} type="button" className="gatinho-secreto" aria-label="Um gatinho apareceu! Abrir o Davi Job"
      onClick={() => { setVisita(null); navigate("/gestao/davi-job"); }}>
      <span className="gatinho-secreto__balao">Miau! Me toca 🐾</span>
      <span className="gatinho-secreto__corpo block"><KawaiiCatSvg variant={visita.variante} /></span>
    </button>
  );
}
