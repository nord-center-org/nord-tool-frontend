import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import GatoPixel from "@/react-app/components/davi/GatoPixel";
import { PELAGENS } from "@/react-app/utils/daviJob/sprites";
import { EVENTO_DAVI, criarDetectorPalavra, ehCampoDeTexto } from "@/react-app/utils/segredo";
import "./GatinhoSecreto.css";

const VARIANTES = PELAGENS.map(p => p.id);
const DURACAO_MS = 9000;

/** Easter egg: digitar "davi" (fora de campos de texto) ou disparar EVENTO_DAVI faz um gatinho atravessar a tela. */
export default function GatinhoSecreto() {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<{ chave: number; variante: string } | null>(null);

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
      <span className="gatinho-secreto__corpo block"><GatoAndando pelagem={visita.variante} /></span>
    </button>
  );
}

/** Gatinho andando (troca as patinhas a cada 150 ms). */
function GatoAndando({ pelagem }: { pelagem: string }) {
  const [passo, setPasso] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setPasso(v => !v), 150);
    return () => window.clearInterval(t);
  }, []);
  return <GatoPixel pelagem={pelagem} quadro={{ pose: passo ? "passo" : "parado", cauda: passo ? 1 : 0 }} tamanho={80} />;
}
