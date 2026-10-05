/** Cálculo dos totais do Dashboard a partir da lista de apartamentos (sem dependências, testável em node). */

export interface ApartamentoParaDashboard {
  nmApartamentoVistoria?: string | null;
  nmStatusVistoria?: string | null;
  dtApartamentoVigente?: string | null;
}

export interface FiltrosDashboard {
  /** yyyy-MM-dd (valor de <input type="date">) */
  startDate?: string;
  endDate?: string;
  /** Prefixo da obra: N1, N2 ou EN. */
  condo?: string;
}

export interface TotaisDashboard {
  total: number;
  total_cadastrados: number;
  agendados: number;
  liberados: number;
  aprovados: number;
  reprovados: number;
  pendentes: number;
  nao_liberados: number;
}

export function normalizarStatus(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/** Aceita dd/MM/yyyy, yyyy-MM-dd e ISO com horário; devolve yyyy-MM-dd ou null. */
export function paraDataIso(valor?: string | null): string | null {
  if (!valor) return null;
  const texto = String(valor).split('T')[0].trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

function passaNoFiltro(apt: ApartamentoParaDashboard, filtros: FiltrosDashboard): boolean {
  if (filtros.condo) {
    const nome = (apt.nmApartamentoVistoria ?? '').toUpperCase();
    if (!nome.startsWith(filtros.condo.toUpperCase())) return false;
  }
  if (filtros.startDate || filtros.endDate) {
    const data = paraDataIso(apt.dtApartamentoVigente);
    if (!data) return false; // sem data não entra em filtro por período
    if (filtros.startDate && data < filtros.startDate) return false;
    if (filtros.endDate && data > filtros.endDate) return false;
  }
  return true;
}

export function calcularDashboard(
  apartamentos: ApartamentoParaDashboard[],
  filtros: FiltrosDashboard = {},
): TotaisDashboard {
  const t: TotaisDashboard = {
    total: 0, total_cadastrados: 0, agendados: 0, liberados: 0,
    aprovados: 0, reprovados: 0, pendentes: 0, nao_liberados: 0,
  };
  for (const apt of apartamentos) {
    if (!passaNoFiltro(apt, filtros)) continue;
    t.total += 1;
    switch (normalizarStatus(apt.nmStatusVistoria ?? '')) {
      case 'naoliberado': t.nao_liberados += 1; break;
      case 'agendado': t.agendados += 1; break;
      case 'liberado': t.liberados += 1; break;
      case 'aprovado':
      case 'aprovadodat': t.aprovados += 1; break;
      case 'reprovado': t.reprovados += 1; break;
      case 'pendente':
      case 'pendentedat': t.pendentes += 1; break;
      default: break; // status desconhecido só conta no total
    }
  }
  t.total_cadastrados = t.total;
  return t;
}
