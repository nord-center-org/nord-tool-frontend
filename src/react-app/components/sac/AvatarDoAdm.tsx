import Avatar from "@/react-app/components/avatar/Avatar";
import type { Chamado } from "@/react-app/services/SacService";
import { lerAvatar } from "@/react-app/utils/avatar";

/** O avatar de quem respondeu o chamado (o padrão do cargo, se a pessoa ainda não montou o dela). */
export default function AvatarDoAdm({ c, tamanho = 56, animado = false, className }: { c: Chamado; tamanho?: number; animado?: boolean; className?: string }) {
  const config = lerAvatar(c.dsConfigResposta ?? null, c.idUsuarioResposta ?? 0, c.nmCargoResposta ?? null);
  return <Avatar config={config} tamanho={tamanho} animado={animado} rotulo={c.nmUsuarioResposta ?? "Administrador"} className={className} />;
}
