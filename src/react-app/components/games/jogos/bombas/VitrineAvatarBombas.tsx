import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AvatarConfig } from "@/react-app/utils/avatar";
import { novaPartida } from "@/react-app/utils/games/bombas";
import { criarAvatarBombas3d } from "./avatarBombas3d";

/** A prévia usa o mesmo personagem articulado da arena; não envia dados para a conta. */
export default function VitrineAvatarBombas({ avatar }: { avatar: AvatarConfig }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [acao, setAcao] = useState("parado");
  const acaoAtual = useRef(acao); acaoAtual.current = acao;
  const [sem3d, setSem3d] = useState(false);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setSem3d(true); return; }
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-label", "Prévia do seu personagem 3D");
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const cena = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(1.4, 1.3, 3.2); camera.lookAt(0.5, 0.86, 0.5);
    cena.add(new THREE.HemisphereLight("#f1fbff", "#49405c", 2.5));
    const luz = new THREE.DirectionalLight("#ffe6c3", 3); luz.position.set(-2, 4, 3); cena.add(luz);
    const contra = new THREE.DirectionalLight("#8ce1ff", 2); contra.position.set(3, 2, -2); cena.add(contra);
    const modelo = criarAvatarBombas3d(avatar, "#67e8f9"); cena.add(modelo.grupo);
    const e = novaPartida({ modo: "sobrevivencia", bioma: "fabrica", semente: 1, jogadores: [{ nome: "Prévia", bot: null }] });
    const j = e.jogadores[0]; j.x = j.y = j.alvoX = j.alvoY = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let antes = performance.now(), quadro = 0;
    const redimensionar = () => { const { width, height } = el.getBoundingClientRect(); renderer.setSize(Math.max(1, width), Math.max(1, height)); camera.aspect = Math.max(1, width) / Math.max(1, height); camera.updateProjectionMatrix(); };
    const obs = new ResizeObserver(redimensionar); obs.observe(el); redimensionar();
    const laco = (agora: number) => {
      const dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
      if (acaoAtual.current === "andando") j.y += dt * 2.4;
      j.alvoY = j.y;
      modelo.atualizar(j, 0, j.y, dt, acaoAtual.current === "vitoria", media.matches || document.documentElement.classList.contains("nt-menos-movimento"));
      modelo.grupo.position.z = 0.5;
      renderer.render(cena, camera); quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => { cancelAnimationFrame(quadro); obs.disconnect(); modelo.destruir(); renderer.dispose(); renderer.domElement.remove(); };
  }, [avatar]);
  return <div className="overflow-hidden rounded-2xl border border-cyan-200/15 bg-gradient-to-b from-cyan-200/10 to-slate-900">
    <div ref={caixa} className="h-48 w-full">{sem3d && <p className="p-6 text-xs text-slate-300">Prévia 3D indisponível neste aparelho; a arena também oferece desenho 2D.</p>}</div>
    <div className="flex gap-1 px-3 pb-3" role="group" aria-label="Animação do personagem">{[{ v: "parado", t: "Parado" }, { v: "andando", t: "Andar" }, { v: "vitoria", t: "Comemorar" }].map(a => <button key={a.v} type="button" aria-pressed={acao === a.v} onClick={() => setAcao(a.v)} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${acao === a.v ? "bg-cyan-200 text-slate-950" : "bg-white/5 text-slate-300"}`}>{a.t}</button>)}</div>
  </div>;
}
