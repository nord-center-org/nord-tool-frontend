import { ImageOff } from "lucide-react";
import { useBlobUrl } from "@/react-app/hooks/useBlobUrl";

interface ImagemAutenticadaProps {
  /** Identifica o recurso e sua versão (ex.: `foto:12:miniatura:1730000000`). */
  chave: string | null;
  carregar: () => Promise<Blob>;
  alt: string;
  className?: string;
  onClick?: () => void;
}

/** <img> para recursos que exigem token: baixa via apiClient e usa object URL. */
export default function ImagemAutenticada({ chave, carregar, alt, className = "", onClick }: ImagemAutenticadaProps) {
  const { url, carregando, erro } = useBlobUrl(chave, carregar);

  if (erro) {
    return (
      <div
        role="img"
        aria-label={`${alt} (indisponível)`}
        title={erro}
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  if (carregando || !url) {
    return <div aria-busy="true" aria-label={`Carregando ${alt}`} className={`animate-pulse bg-slate-100 ${className}`} />;
  }

  return <img src={url} alt={alt} className={className} onClick={onClick} draggable={false} />;
}
