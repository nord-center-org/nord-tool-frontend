/** Regras puras da home animada (cena da obra com a equipe). */
import type { DataComemorativa } from "./avatar.ts";

export type Periodo = "manha" | "tarde" | "noite";

/** Hora (0-23) no fuso de São Paulo. */
export function horaSaoPaulo(agora: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(agora);
  return Number(h) % 24;
}

export function periodoDoDia(hora: number): Periodo {
  if (hora >= 5 && hora < 12) return "manha";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noite";
}

export function saudacao(periodo: Periodo, nome: string | null | undefined): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  const base = periodo === "manha" ? "Bom dia" : periodo === "tarde" ? "Boa tarde" : "Boa noite";
  return primeiro ? `${base}, ${primeiro}!` : `${base}!`;
}

export function mensagemDaData(tema: DataComemorativa | null): string | null {
  switch (tema) {
    case "natal": return "Feliz Natal para toda a equipe! 🎄";
    case "anoNovo": return "Feliz Ano Novo! Que venham novas obras 🎆";
    case "carnaval": return "Bom Carnaval! Juízo e capacete 🎭";
    case "pascoa": return "Feliz Páscoa! 🐰";
    case "junina": return "Arraiá da obra! 🌽";
    case "halloween": return "Feliz Halloween! 🎃";
    default: return null;
  }
}

export const FRASES = [
  "Bora concretar!", "Capacete na cabeça!", "Cadê o café?", "Prumo e nível!", "Segurança em primeiro lugar!",
  "Hoje sai a laje!", "Partiu vistoria!", "Medição em dia!", "Bom trabalho, equipe!", "Olha a betoneira!",
];

/** Frase de cada toque: muda a cada toque e por pessoa, sem repetir a anterior. */
export function fraseDoToque(idPessoa: number, toques: number): string {
  return FRASES[(Math.abs(idPessoa) * 7 + toques * 3) % FRASES.length];
}

/** Coloca o item `indice` no meio da fila (o usuário logado fica no centro da cena). */
export function centralizar<T>(lista: T[], indice: number): T[] {
  if (indice < 0 || indice >= lista.length) return lista;
  const resto = lista.filter((_, i) => i !== indice);
  const meio = Math.floor(resto.length / 2);
  return [...resto.slice(0, meio), lista[indice], ...resto.slice(meio)];
}
