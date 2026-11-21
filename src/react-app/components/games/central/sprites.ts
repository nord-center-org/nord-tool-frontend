import { avatarAleatorio, lerAvatar, type AvatarConfig } from "@/react-app/utils/avatar";
import { rng } from "@/react-app/utils/games/bombas";
import { LADO, montarGrade } from "@/react-app/utils/avatarPixel";

/** Cores de P1 a P8 (anel e destaques), as mesmas em menus, controles e jogos. */
export const CORES_JOGADORES = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];

const cache = new Map<string, HTMLCanvasElement>();

/** O avatar pixel 32×32 (sem fundo) num canvas, para desenhar nos jogos com image-rendering pixelado. */
export function spriteDoAvatar(config: AvatarConfig, chave: string): HTMLCanvasElement {
  const salvo = cache.get(chave);
  if (salvo) return salvo;
  const c = document.createElement("canvas");
  c.width = LADO;
  c.height = LADO;
  const ctx = c.getContext("2d")!;
  const grade = montarGrade(config, null, false, true);
  for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) {
    const cor = grade[y]?.[x];
    if (!cor) continue;
    ctx.fillStyle = cor;
    ctx.fillRect(x, y, 1, 1);
  }
  cache.set(chave, c);
  return c;
}

/** Avatar de cada vaga: P1 usa o avatar de quem está jogando; os outros (bots) ganham um avatar próprio, sempre o mesmo por vaga. */
export function avatarDaVaga(vaga: number, meu: { dsConfig: string | null; idUsuario: number } | null): AvatarConfig {
  if (vaga === 0 && meu) return lerAvatar(meu.dsConfig, meu.idUsuario);
  // Bots: avatar sorteado com semente fixa por vaga (sempre o mesmo P2, P3…), com roupas e cabelos variados.
  return { ...avatarAleatorio(rng(7919 * (vaga + 3))), datas: false };
}
