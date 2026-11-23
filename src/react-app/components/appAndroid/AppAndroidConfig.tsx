import { useEffect, useState } from "react";
import { Download, PackageCheck, RefreshCw, Smartphone } from "lucide-react";
import { ENDERECO_APK, infoDoApp, situacaoDoApp } from "@/react-app/utils/appAndroid";

/** Configurações → App Android: a versão instalada e os botões "Verificar atualizações" e "Instalar a última versão" (só aparecem dentro do app). */
export default function AppAndroidConfig() {
  const [info] = useState(() => infoDoApp(typeof navigator === "undefined" ? undefined : navigator.userAgent));
  const [publicada, setPublicada] = useState<{ codigo: number; nome: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!info) return;
    fetch(`/app/versao.json?t=${Date.now()}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((v: { versionCode?: number; versionName?: string } | null) => {
        if (v && typeof v.versionCode === "number") setPublicada({ codigo: v.versionCode, nome: v.versionName ?? String(v.versionCode) });
      })
      .catch(() => undefined);
  }, [info]);

  if (!info) return null;
  const situacao = situacaoDoApp(info.versao, publicada?.codigo ?? null);

  const verificar = () => {
    if (info.verificar) {
      info.verificar();
      setAviso("Conferindo… Se tiver versão nova, o app baixa sozinho e pede para você autorizar a instalação.");
    } else {
      // Apps antigos não sabem se atualizar por aqui: baixa o APK novo e a pessoa instala por cima.
      setAviso("Baixando o app novo. Quando terminar, abra o arquivo e toque em \"Atualizar\". Seus dados continuam no app.");
      window.location.href = ENDERECO_APK;
    }
  };

  // Instalar à mão a versão publicada (mesmo se já for a mesma): útil quando a atualização automática não passou.
  const instalar = () => {
    if (info.instalar) {
      info.instalar();
      setAviso("Baixando a última versão… Quando terminar, o Android pede para você confirmar a instalação.");
    } else {
      setAviso("Baixando o app. Quando terminar, abra o arquivo e toque em \"Instalar\" ou \"Atualizar\". Seus dados continuam no app.");
      window.location.href = ENDERECO_APK;
    }
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-5 shadow-sm" aria-labelledby="config-app-android">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Smartphone className="h-6 w-6" /></span>
        <div className="min-w-0">
          <h3 id="config-app-android" className="text-lg font-bold text-slate-800">App Android</h3>
          <p className="text-xs font-medium text-slate-500">
            Instalado: {info.nomeVersao ?? (info.versao ? String(info.versao) : "versão antiga")}
            {publicada ? ` · mais nova: ${publicada.nome}` : ""}
          </p>
          <p className={`mt-0.5 text-xs font-bold ${situacao === "atualizado" ? "text-emerald-700" : situacao === "desconhecido" ? "text-slate-500" : "text-amber-700"}`} aria-live="polite">
            {situacao === "atualizado" ? "Você está na versão mais nova." : situacao === "desatualizado" ? "Tem atualização disponível." : situacao === "antigo" ? "Este app é de uma versão antiga: atualize para receber tudo." : ""}
          </p>
          {aviso && <p className="mt-1 text-xs text-slate-600" role="status">{aviso}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={verificar} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
          {info.verificar ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {info.verificar ? "Verificar atualizações" : "Baixar atualização"}
        </button>
        <button type="button" onClick={instalar} title="Baixa e instala a versão publicada, mesmo que já seja a que está no celular"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
          <PackageCheck className="h-4 w-4" />Instalar a última versão
        </button>
      </div>
    </section>
  );
}
