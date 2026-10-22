import { useEffect, useSyncExternalStore } from "react";

import { avatarService, type AvatarUsuario } from "@/react-app/services/AvatarService";

/** Avatar do usuário logado, compartilhado entre o menu e o editor (uma busca por sessão). */
interface Estado { idUsuario: number | null; avatar: AvatarUsuario | null; carregado: boolean }

let estado: Estado = { idUsuario: null, avatar: null, carregado: false };
const ouvintes = new Set<() => void>();

const mudar = (novo: Estado) => { estado = novo; ouvintes.forEach(f => f()); };

export function definirMeuAvatar(a: AvatarUsuario) {
  mudar({ idUsuario: a.idUsuario, avatar: a, carregado: true });
}

function carregar(idUsuario: number) {
  if (estado.idUsuario === idUsuario) return;
  mudar({ idUsuario, avatar: null, carregado: false });
  avatarService.meu()
    .then(a => { if (estado.idUsuario === idUsuario) mudar({ idUsuario, avatar: a ?? null, carregado: true }); })
    // Sem avatar salvo ou backend fora: desenha o padrão.
    .catch(() => { if (estado.idUsuario === idUsuario) mudar({ idUsuario, avatar: null, carregado: true }); });
}

/** `undefined` enquanto carrega; `null` = não há avatar (usa o padrão). */
export function useMeuAvatar(idUsuario: number | null | undefined): AvatarUsuario | null | undefined {
  useEffect(() => { if (idUsuario) carregar(idUsuario); }, [idUsuario]);
  const atual = useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => estado,
  );
  if (!idUsuario || atual.idUsuario !== idUsuario || !atual.carregado) return undefined;
  return atual.avatar;
}
