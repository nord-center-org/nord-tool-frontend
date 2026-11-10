/** Ritmo do Lugia Nexus discreto: aparece, vai embora e de vez em quando espia pelo canto da tela. */

/** Quanto tempo ele fica na tela quando aparece sem novidade (passando o mouse, ele espera). */
export const VISITA_MS = 4_500;
/** Quanto tempo a cabeça fica para fora numa espiada antes de ele voltar a se esconder. */
export const ESPIADA_MS = 4_500;
export const ESPIADA_MIN_MS = 40_000;
export const ESPIADA_MAX_MS = 95_000;

export type LadoEspiada = "lado" | "baixo";

/** Quanto esperar até a próxima espiada (sorteado, para não parecer relógio). */
export const intervaloEspiada = (sorteio: () => number): number =>
  Math.round(ESPIADA_MIN_MS + Math.min(1, Math.max(0, sorteio())) * (ESPIADA_MAX_MS - ESPIADA_MIN_MS));

/** De onde ele espia: da lateral direita (mais comum) ou de baixo. */
export const ladoDaEspiada = (sorteio: () => number): LadoEspiada => (sorteio() < 0.65 ? "lado" : "baixo");

/** O que ele diz baixinho enquanto espia. */
export const FALAS_ESPIADA = ["Psiu!", "...", "Oi?", "!", "Novidades?"];
export const falaDaEspiada = (sorteio: () => number): string =>
  FALAS_ESPIADA[Math.min(FALAS_ESPIADA.length - 1, Math.floor(Math.max(0, sorteio()) * FALAS_ESPIADA.length))];

/** v3: o porta-voz das novidades segura um cafezinho nas horas pares e o rádio nas ímpares. */
export const oQueSegura = (hora: number): "cafe" | "radio" => (((Math.floor(hora) % 2) + 2) % 2 === 0 ? "cafe" : "radio");

/** v3: primeiro nome para o balão; sem nome, "Novidades". */
export const nomeDoPortaVoz = (nome: string | null | undefined): string => (nome ?? "").trim().split(/\s+/)[0]?.slice(0, 20) || "Novidades";
