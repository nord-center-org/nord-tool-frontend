/**
 * Lê o pacote de projetos no navegador (o ZIP baixado do Construcode ou PDFs soltos): cada página vira desenho
 * vetorial (pdf.js) e passa pela análise pura de projetoVetorial. Também monta a Torre da Escadinha com o resultado.
 */
import { lerPdf } from "./pdfTermo";
import { lerPaginaVetorial } from "./projetoPdfVetor";
import { analisarPrancha, montarTorreDoPacote, type PranchaLida, type TorreDoPacote } from "./projetoVetorial";
import { lerZip } from "./zip";
import { nucleo, type Torre } from "./escadinha";
import { apartamentosPadrao, atribuirLados, definirLados } from "./escadinhaApto";

export interface PacoteLido {
  nome: string;
  pranchas: PranchaLida[];
  /** Arquivos que não deu para ler (com o motivo). */
  falhas: { arquivo: string; motivo: string }[];
}

const MAX_PAGINAS = 6;
const respirar = () => new Promise(r => setTimeout(r, 0));

/** Lê os arquivos escolhidos (ZIPs e PDFs), avisando o andamento a cada prancha. */
export async function lerPacote(arquivos: File[], aoProgredir: (feitos: number, total: number, atual: string) => void): Promise<PacoteLido> {
  const pdfs: { nome: string; bytes: Uint8Array }[] = [];
  const falhas: PacoteLido["falhas"] = [];
  for (const f of arquivos) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) {
      try {
        pdfs.push(...await lerZip(bytes, n => /\.pdf$/i.test(n)));
      } catch (e) {
        falhas.push({ arquivo: f.name, motivo: e instanceof Error ? e.message : "ZIP ilegível" });
      }
    } else if (/\.pdf$/i.test(f.name)) pdfs.push({ nome: f.name, bytes });
    else falhas.push({ arquivo: f.name, motivo: "Formato não suportado (envie PDF ou ZIP). DWG: exporte em PDF no Construcode." });
  }
  const pdfjs = await import("pdfjs-dist");
  const pranchas: PranchaLida[] = [];
  for (let i = 0; i < pdfs.length; i++) {
    const { nome, bytes } = pdfs[i];
    aoProgredir(i, pdfs.length, nome);
    await respirar();
    try {
      const { documento, nrPaginas } = await lerPdf(bytes);
      try {
        for (let p = 1; p <= Math.min(nrPaginas, MAX_PAGINAS); p++) {
          const pagina = await documento.getPage(p);
          const vetor = await lerPaginaVetorial(pagina, pdfjs.OPS as unknown as Record<string, number>);
          pranchas.push(analisarPrancha(nrPaginas > 1 ? `${nome} (pág. ${p})` : nome, vetor));
          pagina.cleanup();
        }
      } finally {
        await documento.destroy();
      }
    } catch (e) {
      falhas.push({ arquivo: nome, motivo: e instanceof Error ? e.message : "PDF ilegível" });
    }
  }
  aoProgredir(pdfs.length, pdfs.length, "");
  return { nome: arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos`, pranchas, falhas };
}

/**
 * Torre da Escadinha a partir do que veio do pacote. Mantém da torre atual o que não vem do projeto (início da obra,
 * espessura de laje, tipologias dos apartamentos quando o contorno não mudou de tamanho).
 */
export function torreDoPacote(dados: TorreDoPacote, nome: string, arquivo: string, atual?: Torre): Torre {
  const { contorno } = dados;
  const pavimentos = dados.pavimentos.map(p => (p.tipo === "barrilete" ? { ...p, contorno: nucleo(contorno) } : p));
  const lados = dados.junta ? { ...definirLados(contorno, null, dados.junta), fonte: "junta" as const } : definirLados(contorno, null);
  return {
    nome,
    contorno,
    pavimentos,
    origem: "projeto",
    arquivo,
    lados,
    apartamentos: atribuirLados(apartamentosPadrao(contorno), lados),
    paredes: dados.paredes,
    projeto: dados.projeto,
    inicioObra: atual?.inicioObra ?? null,
    espessuraLaje: atual?.espessuraLaje,
  };
}

export { montarTorreDoPacote };
