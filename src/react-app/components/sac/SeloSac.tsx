import { useNovidadesSac } from "@/react-app/hooks/useNovidadesSac";

/** Selo no item SAC do menu: respostas não vistas (vermelho) e, para o ADMIN, chamados abertos (azul). */
export default function SeloSac() {
  const { chamados, abertos } = useNovidadesSac();
  if (chamados.length) {
    return <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white" aria-label={`${chamados.length} resposta(s) nova(s) nos seus chamados`}>{chamados.length}</span>;
  }
  if (abertos) {
    return <span className="ml-auto rounded-full bg-blue-100 px-1.5 text-[11px] font-black text-blue-700" aria-label={`${abertos} chamado(s) aberto(s)`}>{abertos}</span>;
  }
  return null;
}
