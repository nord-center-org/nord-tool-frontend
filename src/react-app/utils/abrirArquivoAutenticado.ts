/**
 * Abre em nova aba um arquivo que exige token (PDF/imagem): baixa o blob e abre o object URL.
 * A aba é aberta antes do download para não ser bloqueada como pop-up.
 */
export async function abrirArquivoAutenticado(carregar: () => Promise<Blob>): Promise<void> {
  const janela = window.open("about:blank", "_blank");
  try {
    const blob = await carregar();
    const url = URL.createObjectURL(blob);
    if (janela) {
      janela.location.href = url;
    } else {
      window.location.assign(url);
    }
    // O object URL precisa viver enquanto a aba o usa.
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (erro) {
    janela?.close();
    throw erro;
  }
}
