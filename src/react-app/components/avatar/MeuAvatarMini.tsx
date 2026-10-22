import Avatar from "@/react-app/components/avatar/Avatar";
import { useMeuAvatar } from "@/react-app/hooks/useMeuAvatar";
import { lerAvatar, temaDoAvatar } from "@/react-app/utils/avatar";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";

/** Avatar do usuário logado (o salvo ou o padrão), já com o tema da época. */
export default function MeuAvatarMini({ idUsuario, tamanho = 40, className }: { idUsuario: number; tamanho?: number; className?: string }) {
  const salvo = useMeuAvatar(idUsuario);
  const config = lerAvatar(salvo?.dsConfig, idUsuario, salvo?.nmCargo);
  return <Avatar config={config} tema={temaDoAvatar(config, hojeSaoPaulo())} tamanho={tamanho} className={className} />;
}
