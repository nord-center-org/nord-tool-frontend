import { useEffect, useState } from "react";
import { cacheBlobs } from "@/react-app/utils/blobCache";

export interface BlobUrlEstado {
  url: string | null;
  carregando: boolean;
  erro: string | null;
}

/**
 * Baixa um recurso autenticado (imagem/PDF) e devolve um object URL para usar em <img src>.
 * O blob fica em cache por `chave` (id + versão); o object URL é revogado ao desmontar.
 * `<img src>` e `<a href>` não enviam o token, por isso o download passa pelo apiClient.
 */
export function useBlobUrl(chave: string | null, carregar: () => Promise<Blob>): BlobUrlEstado {
  const [estado, setEstado] = useState<BlobUrlEstado>({ url: null, carregando: chave !== null, erro: null });

  useEffect(() => {
    if (chave === null) {
      setEstado({ url: null, carregando: false, erro: null });
      return;
    }
    let ativo = true;
    let url: string | null = null;
    setEstado({ url: null, carregando: true, erro: null });

    const emCache = cacheBlobs.get(chave);
    const obter = emCache ? Promise.resolve(emCache) : carregar().then(blob => {
      cacheBlobs.set(chave, blob);
      return blob;
    });

    obter
      .then(blob => {
        if (!ativo) return;
        url = URL.createObjectURL(blob);
        setEstado({ url, carregando: false, erro: null });
      })
      .catch(e => {
        if (!ativo) return;
        setEstado({ url: null, carregando: false, erro: e instanceof Error ? e.message : "Não foi possível carregar o arquivo." });
      });

    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
    // `carregar` muda a cada render; a chave identifica o recurso e sua versão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return estado;
}
