import { avatarAleatorio, lerAvatar, type AvatarConfig } from "@/react-app/utils/avatar";
import { rng } from "@/react-app/utils/games/bombas";
import { LADO, montarGrade } from "@/react-app/utils/avatarPixel";
import { ALTURA_CORPO, LARGURA_CORPO, QUADROS, montarCorpo, type AcaoCorpo, type DirecaoCorpo } from "@/react-app/utils/games/corpo";

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

/** Linhas da folha do corpo inteiro: cada animação numa linha, quadros lado a lado. */
const LINHAS: [DirecaoCorpo, AcaoCorpo][] = [
  ["baixo", "parado"], ["baixo", "andando"], ["cima", "parado"], ["cima", "andando"], ["lado", "parado"], ["lado", "andando"], ["baixo", "vitoria"],
];
const folhas = new Map<string, HTMLCanvasElement>();

/** Folha de sprites do corpo inteiro do avatar (32×48 por quadro), gerada uma vez e guardada. */
export function folhaDoCorpo(config: AvatarConfig, chave: string): HTMLCanvasElement {
  const salva = folhas.get(chave);
  if (salva) return salva;
  const c = document.createElement("canvas");
  c.width = LARGURA_CORPO * 4;
  c.height = ALTURA_CORPO * LINHAS.length;
  const ctx = c.getContext("2d")!;
  LINHAS.forEach(([direcao, acao], linha) => {
    for (let q = 0; q < QUADROS[acao]; q++) {
      const g = montarCorpo(config, { direcao, acao, quadro: q });
      g.forEach((l, y) => l.forEach((cor, x) => {
        if (!cor) return;
        ctx.fillStyle = cor;
        ctx.fillRect(q * LARGURA_CORPO + x, linha * ALTURA_CORPO + y, 1, 1);
      }));
    }
  });
  folhas.set(chave, c);
  return c;
}

/** Recorte do quadro na folha: direção, ação e tempo (em segundos) escolhem o quadro da animação. */
export function quadroDoCorpo(direcao: DirecaoCorpo, acao: AcaoCorpo, tempo: number): { sx: number; sy: number; w: number; h: number } {
  const linha = acao === "vitoria" ? 6 : LINHAS.findIndex(([d, a]) => d === direcao && a === acao);
  const fps = acao === "andando" ? 9 : acao === "vitoria" ? 4 : 2;
  const q = Math.floor(tempo * fps) % QUADROS[acao];
  return { sx: q * LARGURA_CORPO, sy: linha * ALTURA_CORPO, w: LARGURA_CORPO, h: ALTURA_CORPO };
}

/** Desenha o corpo com os pés em (x, y); {@code altura} em pixels de tela; espelha olhando para a esquerda. */
export function desenharCorpo(ctx: CanvasRenderingContext2D, folha: HTMLCanvasElement, direcao: "baixo" | "cima" | "esquerda" | "direita",
  acao: AcaoCorpo, tempo: number, x: number, y: number, altura: number) {
  const dir: DirecaoCorpo = direcao === "esquerda" || direcao === "direita" ? "lado" : direcao;
  const r = quadroDoCorpo(dir, acao, tempo);
  const largura = altura * (LARGURA_CORPO / ALTURA_CORPO);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  if (direcao === "esquerda" && acao !== "vitoria") ctx.scale(-1, 1);
  ctx.drawImage(folha, r.sx, r.sy, r.w, r.h, -largura / 2, -altura, largura, altura);
  ctx.restore();
}
