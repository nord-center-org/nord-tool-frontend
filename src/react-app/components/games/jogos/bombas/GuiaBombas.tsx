import { Bomb, Flame, Footprints, Hand, Radio, Shield, Skull, Sparkles, Timer, Trophy, MoveRight, Coins } from "lucide-react";
import type { Modo } from "@/react-app/utils/games/bombas";
import type { VagaJogo } from "../../comum/MolduraPartida";
import VitrineAvatarBombas from "./VitrineAvatarBombas";

const ITENS = [
  { nome: "Ovo de montaria", efeito: "Brasa: B arremessa bomba; Vento: B dispara; Pedra: B protege. A montaria absorve um golpe.", Icone: Sparkles, cor: "text-emerald-200" },
  { nome: "Bomba", efeito: "+1 bomba ao mesmo tempo", Icone: Bomb, cor: "text-blue-300" },
  { nome: "Fogo", efeito: "+1 casa de alcance", Icone: Flame, cor: "text-orange-300" },
  { nome: "Patins", efeito: "Anda mais rápido", Icone: Footprints, cor: "text-sky-300" },
  { nome: "Chute", efeito: "Empurre uma bomba andando contra ela", Icone: MoveRight, cor: "text-green-300" },
  { nome: "Luva", efeito: "B arremessa a bomba aos seus pés", Icone: Hand, cor: "text-yellow-300" },
  { nome: "Detonador", efeito: "B detona sua bomba remota mais antiga", Icone: Radio, cor: "text-rose-300" },
  { nome: "Escudo", efeito: "Protege de uma explosão", Icone: Shield, cor: "text-purple-300" },
  { nome: "Fogo total", efeito: "Alcance de 10 casas", Icone: Sparkles, cor: "text-amber-300" },
  { nome: "Caveira", efeito: "Uma maldição por 10 segundos. Evite!", Icone: Skull, cor: "text-slate-300" },
];

export default function GuiaBombas({ modo, solo, vagas, campanha = false }: { campanha?: boolean; modo: Modo; solo: boolean; vagas: VagaJogo[] }) {
  const objetivo = campanha ? "Restaure a energia das três regiões em 9 fases. Derrote os inimigos com bombas e entre no portal verde. Cada terceira fase tem um chefe. Todos jogam juntos; cuidado, as bombas atingem aliados." : solo
    ? modo === "moedas" ? "Encontre 10 moedas antes de 2 minutos. Você vence assim que completar a meta." : "Exploda todas as caixas antes do tempo, sem cair."
    : modo === "moedas" ? "Termine os 2 minutos com mais moedas. Ao cair, perde até 3 e volta em 3 segundos."
      : modo === "times" ? "P1, P3, P5 e P7 contra P2, P4, P6 e P8. Deixe apenas seu time de pé. As explosões também atingem aliados."
        : "Seja o último de pé. Ganhe as rodadas necessárias para vencer a partida.";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
      {vagas[0] && <VitrineAvatarBombas avatar={vagas[0].avatar} />}
      <div className="flex flex-col justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-200"><Trophy className="h-4 w-4" />Sua missão</p>
        <p className="text-sm leading-relaxed text-amber-50">{objetivo}</p>
        <p className="mt-4 text-xs leading-relaxed text-amber-100/65">Seu avatar ganha corpo, roupa e articulações em 3D. Experimente as animações na prévia.</p>
      </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          { titulo: "1. Abra caminho", texto: "Mova-se, plante uma bomba com A e procure uma saída antes de explodir.", Icone: Bomb },
          { titulo: "2. Leia a arena", texto: "O pavio dura 2,5 s. A chama faz uma cruz e para no pilar ou na primeira caixa.", Icone: Timer },
          { titulo: "3. Vire o jogo", texto: "Pegue itens das caixas. Uma explosão pode detonar outras bombas na hora!", Icone: modo === "moedas" ? Coins : Sparkles },
        ].map(({ titulo, texto, Icone }) => <li key={titulo} className="rounded-2xl bg-white/5 p-4"><Icone className="mb-3 h-6 w-6 text-cyan-200" /><h3 className="mb-1 text-sm font-black">{titulo}</h3><p className="text-xs leading-relaxed text-slate-300">{texto}</p></li>)}
      </ol>
      <p className="rounded-xl bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-100">{campanha ? "Você começa com 3 vidas extras compartilhadas. Start entra no meio da fase, gastando uma vida. Morrer também usa uma reserva para voltar. Cada fase concluída e cada 3.000 pontos dão uma vida. O próximo checkpoint fica salvo neste aparelho." : "Ao cair na batalha, você volta na borda depois de um instante. Mova o carrinho, use A para lançar e B para mudar a distância. Eliminar um rival com essa bomba devolve você à arena. A revanche termina quando começa a morte súbita."}</p>
      <details className="rounded-xl border border-white/10 p-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-slate-300">Itens e montarias</summary>
        <ul className="grid gap-2 sm:grid-cols-3">{ITENS.map(({ nome, efeito, Icone, cor }) => <li key={nome} className="flex gap-2 rounded-xl border border-white/5 p-2.5"><Icone className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} /><div><p className="text-xs font-bold">{nome}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{efeito}</p></div></li>)}</ul>
      </details>
      <p className="text-xs leading-relaxed text-slate-300">A cor e o número na bomba identificam o dono; o arco mostra o pavio restante. No último minuto, casas marcadas com um X vão receber um bloco: saia delas! O escudo não protege de um bloco.</p>
      <p className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-slate-400">Teclado padrão: setas/WASD para andar, Espaço/Z para A, X/Shift para B e Esc para pausa. No celular ou gamepad, use A e B. Você pode remapear em Controles. O jogo respeita a preferência de menos movimento do seu aparelho.</p>
    </div>
  );
}
