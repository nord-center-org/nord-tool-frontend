import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** O que os controles de órbita do drei expõem e a navegação usa. */
interface Orbita { target: THREE.Vector3; update: () => void; enabled: boolean }

const TECLAS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);

/**
 * Navegação livre por cima dos controles de órbita (como no SketchUp):
 * - duplo clique num ponto: a órbita passa a girar em volta dele (a câmera desliza até lá sem mudar o ângulo);
 * - W A S D / setas andam pela cena, Q e E descem e sobem (Shift corre); valem com o mouse em cima do 3D;
 * - `enquadrar` (via `onPronto`) volta a mostrar tudo.
 * Precisa de OrbitControls com makeDefault.
 */
export default function NavegacaoLivre({ onPronto, ativo = true }: { onPronto?: (acoes: { enquadrar: () => void; deCima: () => void }) => void; ativo?: boolean }) {
  const { camera, gl, scene, controls } = useThree();
  const destino = useRef<{ alvo: THREE.Vector3; camera: THREE.Vector3 } | null>(null);
  const teclas = useRef(new Set<string>());
  const dentro = useRef(false);

  // Duplo clique: centro da órbita no ponto clicado.
  useEffect(() => {
    if (!ativo) return;
    const el = gl.domElement;
    const raio = new THREE.Raycaster();
    const ponto = new THREE.Vector2();
    const duplo = (e: MouseEvent) => {
      const orb = controls as unknown as Orbita | null;
      if (!orb) return;
      const r = el.getBoundingClientRect();
      ponto.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raio.setFromCamera(ponto, camera);
      const acerto = raio.intersectObjects(scene.children, true).find(i => i.object.visible && (i.object as THREE.Mesh).isMesh);
      if (!acerto) return;
      const desloc = acerto.point.clone().sub(orb.target);
      destino.current = { alvo: acerto.point.clone(), camera: camera.position.clone().add(desloc) };
    };
    const entrar = () => { dentro.current = true; };
    const sair = () => { dentro.current = false; teclas.current.clear(); };
    el.addEventListener("dblclick", duplo);
    el.addEventListener("pointerenter", entrar);
    el.addEventListener("pointerleave", sair);
    return () => {
      el.removeEventListener("dblclick", duplo);
      el.removeEventListener("pointerenter", entrar);
      el.removeEventListener("pointerleave", sair);
    };
  }, [ativo, camera, gl, scene, controls]);

  // Teclado: só com o mouse em cima do 3D e fora de campos de texto.
  useEffect(() => {
    if (!ativo) return;
    const digitando = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    };
    const baixo = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!dentro.current || digitando(e) || !TECLAS.has(k)) return;
      if (k !== "shift") e.preventDefault();
      teclas.current.add(k);
    };
    const cima = (e: KeyboardEvent) => { teclas.current.delete(e.key.toLowerCase()); };
    const limpar = () => teclas.current.clear();
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    window.addEventListener("blur", limpar);
    return () => {
      window.removeEventListener("keydown", baixo);
      window.removeEventListener("keyup", cima);
      window.removeEventListener("blur", limpar);
    };
  }, [ativo]);

  // Enquadrar tudo / ver de cima.
  useEffect(() => {
    if (!onPronto) return;
    const caixa = () => {
      const c = new THREE.Box3();
      scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) c.expandByObject(o); });
      return c;
    };
    onPronto({
      enquadrar: () => {
        const orb = controls as unknown as Orbita | null;
        const c = caixa();
        if (!orb || c.isEmpty()) return;
        const centro = c.getCenter(new THREE.Vector3());
        const raioC = c.getSize(new THREE.Vector3()).length() / 2;
        const dir = camera.position.clone().sub(orb.target).normalize();
        const dist = raioC / Math.sin(((camera as THREE.PerspectiveCamera).fov ?? 40) * Math.PI / 360);
        destino.current = { alvo: centro, camera: centro.clone().add(dir.multiplyScalar(dist * 0.9)) };
      },
      deCima: () => {
        const orb = controls as unknown as Orbita | null;
        const c = caixa();
        if (!orb || c.isEmpty()) return;
        const centro = c.getCenter(new THREE.Vector3());
        const tam = c.getSize(new THREE.Vector3());
        const dist = Math.max(tam.x, tam.z) / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov ?? 40) * Math.PI / 360));
        destino.current = { alvo: centro, camera: new THREE.Vector3(centro.x, centro.y + dist * 1.05, centro.z + 0.01) };
      },
    });
  }, [onPronto, camera, scene, controls]);

  const frente = useRef(new THREE.Vector3());
  const lado = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const orb = controls as unknown as Orbita | null;
    if (!orb) return;
    const d = destino.current;
    if (d) {
      const k = 1 - Math.exp(-6 * dt);
      orb.target.lerp(d.alvo, k);
      camera.position.lerp(d.camera, k);
      orb.update();
      if (orb.target.distanceTo(d.alvo) < 0.02 && camera.position.distanceTo(d.camera) < 0.02) destino.current = null;
    }
    const t = teclas.current;
    if (!t.size) return;
    destino.current = null;
    const dist = camera.position.distanceTo(orb.target);
    const vel = Math.max(1.5, dist * 0.6) * (t.has("shift") ? 3 : 1) * dt;
    camera.getWorldDirection(frente.current);
    frente.current.y = 0;
    if (frente.current.lengthSq() < 1e-6) frente.current.set(0, 0, -1);
    frente.current.normalize();
    lado.current.crossVectors(frente.current, camera.up).normalize();
    const mov = new THREE.Vector3();
    if (t.has("w") || t.has("arrowup")) mov.add(frente.current);
    if (t.has("s") || t.has("arrowdown")) mov.sub(frente.current);
    if (t.has("d") || t.has("arrowright")) mov.add(lado.current);
    if (t.has("a") || t.has("arrowleft")) mov.sub(lado.current);
    if (t.has("e")) mov.y += 1;
    if (t.has("q")) mov.y -= 1;
    if (mov.lengthSq() === 0) return;
    mov.normalize().multiplyScalar(vel);
    camera.position.add(mov);
    orb.target.add(mov);
    orb.update();
  });
  return null;
}
