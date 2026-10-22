import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, Loader2, RotateCcw, Shuffle, Smile } from "lucide-react";

import Avatar from "@/react-app/components/avatar/Avatar";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import { definirMeuAvatar, useMeuAvatar } from "@/react-app/hooks/useMeuAvatar";
import { avatarService } from "@/react-app/services/AvatarService";
import {
  BARBAS, BOCAS, CABELOS, CORES_CABELO, DATAS, FUNCOES, FUNDOS, OLHOS, PELES,
  avatarAleatorio, lerAvatar, salvarAvatar, temaDoAvatar, type AvatarConfig, type DataComemorativa,
} from "@/react-app/utils/avatar";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";

const ROTULOS: Record<string, string> = {
  curto: "Curto", raspado: "Raspado", moicano: "Moicano", cacheado: "Cacheado", longo: "Longo", coque: "Coque", careca: "Careca",
  normal: "Normal", feliz: "Feliz", piscando: "Piscando", oculos: "Óculos",
  sorriso: "Sorriso", aberta: "Rindo", seria: "Séria",
  nenhuma: "Sem barba", bigode: "Bigode", cavanhaque: "Cavanhaque", cheia: "Cheia",
};

type Previa = DataComemorativa | "nenhuma" | null;

export default function MeuAvatarPage() {
  const { usuario } = useAuth();
  const salvo = useMeuAvatar(usuario?.id);
  const configSalva = useMemo(
    () => (usuario && salvo !== undefined ? lerAvatar(salvo?.dsConfig, usuario.id, salvo?.nmCargo) : null),
    [salvo, usuario],
  );
  const [config, setConfig] = useState<AvatarConfig | null>(null);
  const [previa, setPrevia] = useState<Previa>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Começa do avatar salvo (ou do padrão) assim que ele chega; depois a edição é local até salvar.
  useEffect(() => { if (configSalva && !config) setConfig(configSalva); }, [configSalva, config]);

  if (!usuario || !config) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>;
  }

  const hoje = hojeSaoPaulo();
  const tema = temaDoAvatar(config, hoje, previa ?? undefined);
  const alterado = !configSalva || salvarAvatar(config) !== salvarAvatar(configSalva) || !salvo?.dsConfig;
  const mudar = (parcial: Partial<AvatarConfig>) => { setConfig({ ...config, ...parcial }); setMensagem(null); };

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const novo = await avatarService.salvar(salvarAvatar(config));
      if (novo) definirMeuAvatar(novo);
      setMensagem({ tipo: "ok", texto: "Avatar salvo! Ele já aparece no menu e na home." });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error && e.message ? e.message : "Não foi possível salvar o avatar." });
    } finally {
      setSalvando(false);
    }
  };

  /** Botão de opção com a miniatura do próprio avatar já com aquela escolha. */
  const opcao = (chave: string, ativo: boolean, parcial: Partial<AvatarConfig>, rotulo: string, miniatura = true) => (
    <button key={chave} type="button" aria-pressed={ativo} onClick={() => mudar(parcial)} title={rotulo}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-1.5 text-[11px] font-bold transition-colors ${ativo ? "border-blue-500 bg-blue-50 text-blue-700" : "border-transparent bg-white text-slate-500 hover:border-slate-200"}`}>
      {miniatura && <Avatar config={{ ...config, ...parcial }} tema={tema} tamanho={48} />}
      <span className="max-w-[5.5rem] truncate">{rotulo}</span>
    </button>
  );

  const cor = (chave: string, ativo: boolean, hex: string, parcial: Partial<AvatarConfig>, rotulo: string) => (
    <button key={chave} type="button" aria-pressed={ativo} aria-label={rotulo} title={rotulo} onClick={() => mudar(parcial)}
      className={`h-9 w-9 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${ativo ? "border-blue-600 ring-2 ring-blue-300" : "border-white"}`}
      style={{ background: hex }} />
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <CabecalhoPagina icone={Smile} titulo="Meu avatar" subtitulo="Monte o seu boneco: ele aparece no menu e na home com a equipe."
        acoes={<Link to="/configuracoes" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /> Configurações</Link>} />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Prévia">
          <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Avatar config={config} tema={tema} tamanho={192} rotulo={`Avatar de ${usuario.nome}`} animado />
            <p className="mt-3 text-lg font-black text-slate-800">{usuario.nome}</p>
            <p className="text-xs font-semibold text-slate-500">{FUNCOES[config.funcao].rotulo}{tema ? ` · ${DATAS[tema]}` : ""}</p>
            <div className="mt-4 flex w-full gap-2">
              <button type="button" onClick={() => mudar(avatarAleatorio())} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <Shuffle className="h-4 w-4" /> Sortear
              </button>
              {configSalva && (
                <button type="button" onClick={() => mudar(configSalva)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50" title="Voltar ao salvo">
                  <RotateCcw className="h-4 w-4" /> Desfazer
                </button>
              )}
            </div>
            <button type="button" onClick={() => void salvar()} disabled={salvando || !alterado}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar avatar
            </button>
            {mensagem && (
              <p role={mensagem.tipo === "erro" ? "alert" : "status"} className={`mt-2 w-full rounded-xl px-3 py-2 text-center text-xs font-semibold ${mensagem.tipo === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{mensagem.texto}</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={config.datas} onChange={e => mudar({ datas: e.target.checked })} className="h-4 w-4 accent-blue-600" />
              Vestir as datas comemorativas
            </label>
            <p className="mt-1 text-xs text-slate-500">Na época, o avatar ganha gorro de Natal, orelhas de Páscoa, chapéu de festa junina…</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ver como fica</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Prévia de data comemorativa">
              {([null, "nenhuma", ...Object.keys(DATAS)] as Previa[]).map(d => (
                <button key={d ?? "hoje"} type="button" aria-pressed={previa === d} onClick={() => setPrevia(d)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${previa === d ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {d === null ? "Hoje" : d === "nenhuma" ? "Dia comum" : DATAS[d]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <Grupo titulo="Função na obra" dica="Define a roupa e a cor do capacete.">
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 xl:grid-cols-8">
              {(Object.keys(FUNCOES) as AvatarConfig["funcao"][]).map(f => opcao(f, config.funcao === f, { funcao: f }, FUNCOES[f].rotulo))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={config.capacete} onChange={e => mudar({ capacete: e.target.checked })} className="h-4 w-4 accent-blue-600" />
              Usar capacete
            </label>
          </Grupo>
          <Grupo titulo="Pele">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PELES) as AvatarConfig["pele"][]).map((p, i) => cor(p, config.pele === p, PELES[p], { pele: p }, `Tom de pele ${i + 1}`))}
            </div>
          </Grupo>
          <Grupo titulo="Cabelo">
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {CABELOS.map(c => opcao(c, config.cabelo === c, { cabelo: c, capacete: c === "coque" || c === "moicano" ? false : config.capacete }, ROTULOS[c]))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(CORES_CABELO) as AvatarConfig["corCabelo"][]).map(c => cor(c, config.corCabelo === c, CORES_CABELO[c], { corCabelo: c }, `Cabelo ${c}`))}
            </div>
          </Grupo>
          <div className="grid gap-4 md:grid-cols-2">
            <Grupo titulo="Olhos">
              <div className="grid grid-cols-4 gap-1">{OLHOS.map(o => opcao(o, config.olhos === o, { olhos: o }, ROTULOS[o]))}</div>
            </Grupo>
            <Grupo titulo="Boca">
              <div className="grid grid-cols-3 gap-1">{BOCAS.map(b => opcao(b, config.boca === b, { boca: b }, ROTULOS[b]))}</div>
            </Grupo>
          </div>
          <Grupo titulo="Barba">
            <div className="grid grid-cols-4 gap-1 sm:max-w-md">{BARBAS.map(b => opcao(b, config.barba === b, { barba: b }, ROTULOS[b]))}</div>
          </Grupo>
          <Grupo titulo="Fundo">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FUNDOS) as AvatarConfig["fundo"][]).map(f => cor(f, config.fundo === f, FUNDOS[f], { fundo: f }, `Fundo ${f}`))}
            </div>
          </Grupo>
        </div>
      </div>
    </div>
  );
}

function Grupo({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={titulo}>
      <h3 className="text-sm font-black text-slate-800">{titulo}</h3>
      {dica && <p className="text-xs text-slate-500">{dica}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
