import { useEffect, useRef, useState } from "react";
import type { EstadoCamera } from "@/react-app/utils/drumcamAoVivo";
import { CameraLocal } from "@/react-app/components/drumcam/cameraLocal";
import type { EstadoRele } from "@/react-app/components/drumcam/rele";

type PonteDaPaginaDaCamera = { nomeDaCamera?: () => string; estadoCamera?: (json: string) => void; desligarCamera?: () => void };

function ponte(): PonteDaPaginaDaCamera | undefined {
  return (window as unknown as { NordAndroid?: PonteDaPaginaDaCamera }).NordAndroid;
}

function nomeInicial(): string {
  try {
    const doApp = ponte()?.nomeDaCamera?.();
    if (doApp) return doApp;
  } catch { /* app sem a função */ }
  try { return localStorage.getItem("drumcam-nome") || "Câmera"; } catch { return "Câmera"; }
}

/**
 * App 11.0: a página que o serviço do app abre, fora da tela do NordTool, para ser a câmera ao vivo. Não tem tela
 * para a pessoa (fica numa janelinha invisível): abre a câmera, conecta no relé, atende a Mesa e o Monitoramento e
 * conta ao app como está (no ar, quantos vendo, erro), que a tela principal mostra em Estúdio → Gravação.
 */
export default function CameraServicoPage() {
  const [rele, setRele] = useState<EstadoRele>("conectando");
  const [vendo, setVendo] = useState(0);
  const [estado, setEstado] = useState<EstadoCamera | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const nome = useRef(nomeInicial());

  useEffect(() => {
    const c = new CameraLocal(nome.current, {
      estado: setEstado, rele: setRele, espectadores: setVendo, erro: setErro,
      // Desligada pelo Monitoramento: o app tira o serviço do ar (e esta página junto).
      desligar: () => { c.fechar(); try { ponte()?.desligarCamera?.(); } catch { /* sem a ponte */ } },
    });
    c.abrir().catch(err => setErro(err?.name === "NotAllowedError"
      ? "Sem permissão para a câmera. Libere a câmera e o microfone para o NordTool."
      : `Não deu para abrir a câmera: ${err?.message ?? err}`));
    return () => c.fechar();
  }, []);

  useEffect(() => {
    const contar = () => {
      try {
        ponte()?.estadoCamera?.(JSON.stringify({ rele, vendo, nome: estado?.nome ?? nome.current, gravando: !!estado?.gravando, erro }));
      } catch { /* sem a ponte (navegador) */ }
    };
    contar();
    const t = setInterval(contar, 3_000);
    return () => clearInterval(t);
  }, [rele, vendo, estado, erro]);

  return (
    <main className="p-2 text-xs">
      <p>Câmera ao vivo do NordTool: {rele === "conectado" ? "no ar" : "conectando…"} · {vendo} vendo</p>
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}
