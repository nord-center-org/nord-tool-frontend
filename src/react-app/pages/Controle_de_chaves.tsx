import { useState, useEffect, useId, useMemo, useCallback } from 'react';
import { LayoutDashboard, Users, Archive, PlusCircle, Key, Box, CheckCircle, Clock, X, Edit2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ColaboradorService, Colaborador } from '../services/ColaboradorService';
import { OpcoesColaboradorService, type Empresa, type Cargo, type Permissao } from '../services/OpcoesColaboradorService';
import { apartamentoVistoriaService } from '../services/ApartamentoVistoriaService';
import { podeLiberarChave, podeRetirarChave } from '../utils/elegibilidadeColaborador';
import { ControleChavesService, type ApartamentoControleChaves, type FerramentaControleChaves, type TipoItemControleChaves, type DashboardControleChaves, type RetiradaControleChaves } from '../services/ControleChavesService';
import { EVENTO_OBRA_CONTROLE_CHAVES, lerObraControleChaves } from '../utils/preferenciasControleChaves';
import { ColumnFilter as HistoricoColumnFilter } from '../components/ColumnFilter';
import { VALOR_VAZIO, normalizarTexto, normalizarData, compararValores, type DirecaoOrdenacao } from '../utils/filtroColuna';

type ModalItem = Colaborador | RetiradaControleChaves;
type ColunaHistorico = 'codigo' | 'data' | 'apartamento' | 'retirante' | 'recebedor' | 'status';
type FiltrosHistorico = Partial<Record<ColunaHistorico, string[]>>;
type ColunaRetiradasRecentes = 'codigo' | 'data' | 'apartamento' | 'retirante' | 'liberador' | 'status';
type FiltrosRetiradasRecentes = Partial<Record<ColunaRetiradasRecentes, string[]>>;

const formatarData = (valor?: string | null) => {
  const timestamp = normalizarData(valor);
  return timestamp === null
    ? VALOR_VAZIO
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp);
};

const retiradaAberta = (retirada: RetiradaControleChaves) => {
  return retirada.nmStatusRetiradaControle === 'ABERTO' && !retirada.dtRecebimento;
};

const apartamentoPertenceAObra = (codigo: string, idObra: string) =>
  !idObra || codigo.trim().toLocaleUpperCase('pt-BR').startsWith(idObra);

const apartamentoEntregue = (status?: string) =>
  ['APROVADO', 'APROVADO DAT'].includes(status?.trim().toLocaleUpperCase('pt-BR') ?? '');

const nomeItemRetirada = (retirada: RetiradaControleChaves) =>
  retirada?.apartamentoControleChavesDto?.nmApartamentoVistoria ?? retirada?.ferramentaControleChavesDto?.nmFerramenta;

const listarFerramentasAtivas = async (): Promise<FerramentaControleChaves[]> => {
  const limite = 100;
  const ferramentas: FerramentaControleChaves[] = [];
  let pagina = 0;
  let lote: FerramentaControleChaves[] = [];
  do {
    lote = await ControleChavesService.listarFerramentas('', { limite, pagina });
    ferramentas.push(...lote);
    pagina += 1;
  } while (lote.length === limite);
  return ferramentas;
};

const valorColunaHistorico = (retirada: RetiradaControleChaves, coluna: ColunaHistorico) => {
  const aberta = retiradaAberta(retirada);
  const valores: Record<ColunaHistorico, string> = {
    codigo: normalizarTexto(retirada?.cdCodigoRetirada),
    data: formatarData(retirada.dtRetirada),
    apartamento: normalizarTexto(nomeItemRetirada(retirada)),
    retirante: normalizarTexto(retirada?.retiranteControleChavesDto?.nmPessoaRetirante),
    recebedor: aberta ? VALOR_VAZIO : normalizarTexto(retirada?.recebedorControleChavesDto?.nmPessoaRecebedor),
    status: normalizarTexto(retirada?.nmStatusRetiradaControle),
  };
  return valores[coluna];
};

const valorColunaRetiradaRecente = (retirada: RetiradaControleChaves, coluna: ColunaRetiradasRecentes) => {
  const valores: Record<ColunaRetiradasRecentes, string> = {
    codigo: normalizarTexto(retirada?.cdCodigoRetirada),
    data: formatarData(retirada.dtRetirada),
    apartamento: normalizarTexto(nomeItemRetirada(retirada)),
    retirante: normalizarTexto(retirada?.retiranteControleChavesDto?.nmPessoaRetirante),
    liberador: normalizarTexto(retirada?.liberadorControleChavesDto?.nmPessoaLiberador),
    status: normalizarTexto(retirada?.nmStatusRetiradaControle),
  };
  return valores[coluna];
};

interface TabelaRetiradasAbertasProps {
  titulo: string;
  itens: RetiradaControleChaves[];
  carregando: boolean;
  erro: boolean;
  recebendoId: number | null;
  onReceber: (retirada: RetiradaControleChaves) => void;
}

const COLUNAS_RETIRADAS: [ColunaRetiradasRecentes, string][] = [
  ['codigo', 'Código'], ['data', 'Data'], ['apartamento', 'Item'],
  ['retirante', 'Retirado por'], ['liberador', 'Liberado por'], ['status', 'Status'],
];

/** Tabela de retiradas em aberto de um tipo de item, com filtros/ordenação próprios. */
function TabelaRetiradasAbertas({ titulo, itens, carregando, erro, recebendoId, onReceber }: TabelaRetiradasAbertasProps) {
  const [filtros, setFiltros] = useState<FiltrosRetiradasRecentes>({});
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaRetiradasRecentes; direcao: DirecaoOrdenacao } | null>(null);

  const valoresPorColuna = useMemo(() => Object.fromEntries(
    COLUNAS_RETIRADAS.map(([coluna]) => [
      coluna,
      [...new Set(itens.map(item => valorColunaRetiradaRecente(item, coluna)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    ]),
  ) as Record<ColunaRetiradasRecentes, string[]>, [itens]);

  const filtradas = useMemo(() => {
    const lista = itens.filter(item => Object.entries(filtros).every(([coluna, selecionados]) =>
      selecionados?.includes(valorColunaRetiradaRecente(item, coluna as ColunaRetiradasRecentes))));
    return lista.sort((a, b) => {
      if (!ordenacao) return 0;
      return ordenacao.coluna === 'data'
        ? compararValores(a?.dtRetirada, b?.dtRetirada, ordenacao.direcao, true)
        : compararValores(valorColunaRetiradaRecente(a, ordenacao.coluna), valorColunaRetiradaRecente(b, ordenacao.coluna), ordenacao.direcao);
    });
  }, [itens, filtros, ordenacao]);

  const configurarFiltro = (coluna: ColunaRetiradasRecentes, valores: string[] | null) => {
    setFiltros(atuais => {
      const proximos = { ...atuais };
      if (valores === null) delete proximos[coluna]; else proximos[coluna] = valores;
      return proximos;
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
      <h3 className="font-bold text-lg text-slate-800 mb-4">{titulo} <span className="text-sm font-semibold text-slate-400">({itens.length})</span></h3>
      <div className="min-w-[560px]">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
              {COLUNAS_RETIRADAS.map(([coluna, label]) => (
                <th key={coluna} className="pb-3">
                  <HistoricoColumnFilter
                    label={label}
                    values={valoresPorColuna[coluna]}
                    selected={filtros[coluna] ?? null}
                    sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
                    onApply={valores => configurarFiltro(coluna, valores)}
                    onSort={direcao => setOrdenacao({ coluna, direcao })}
                  />
                </th>
              ))}
              <th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && !erro && filtradas.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">Nenhuma retirada em aberto.</td></tr>
            )}
            {filtradas.map(r => (
              <tr key={r.idRequisicao} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="py-4 font-mono font-bold text-emerald-600">{valorColunaRetiradaRecente(r, 'codigo')}</td>
                <td className="py-4 text-slate-600 text-sm">{valorColunaRetiradaRecente(r, 'data')}</td>
                <td className="py-4 text-slate-800 font-mono font-semibold text-sm">{valorColunaRetiradaRecente(r, 'apartamento')}</td>
                <td className="py-4 text-slate-600 text-sm">{valorColunaRetiradaRecente(r, 'retirante')}</td>
                <td className="py-4 text-slate-600 text-sm">{valorColunaRetiradaRecente(r, 'liberador')}</td>
                <td className="py-4">
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{valorColunaRetiradaRecente(r, 'status')}</span>
                </td>
                <td className="py-4">
                  {retiradaAberta(r) && <button disabled={recebendoId === r.idRequisicao}
                    onClick={() => onReceber(r)}
                    title="Chave Recebida"
                    className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    <CheckCircle size={18} />
                  </button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingColab, setEditingColab] = useState<ModalItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'todos'>(20);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [statusHistorico, setStatusHistorico] = useState('');
  const [tentativaHistorico, setTentativaHistorico] = useState(0);
  const [historico, setHistorico] = useState<RetiradaControleChaves[]>([]);
  const [filtrosHistorico, setFiltrosHistorico] = useState<FiltrosHistorico>({});
  const [ordenacaoHistorico, setOrdenacaoHistorico] = useState<{ coluna: ColunaHistorico; direcao: DirecaoOrdenacao } | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardControleChaves | null>(null);
  const [carregandoDashboard, setCarregandoDashboard] = useState(true);
  const [erroDashboard, setErroDashboard] = useState<string | null>(null);
  const [recebendoId, setRecebendoId] = useState<number | null>(null);
  const [idRecebedor, setIdRecebedor] = useState<number | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [idObra, setIdObra] = useState<string>(() => lerObraControleChaves());

  // Estado dos colaboradores carregados do banco
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(true);
  const [erroColaboradores, setErroColaboradores] = useState<string | null>(null);
  const [salvandoColaborador, setSalvandoColaborador] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [buscaApartamento, setBuscaApartamento] = useState('');
  const [apartamentos, setApartamentos] = useState<ApartamentoControleChaves[]>([]);
  const [apartamentoSelecionado, setApartamentoSelecionado] = useState<ApartamentoControleChaves | null>(null);
  const [carregandoApartamentos, setCarregandoApartamentos] = useState(false);
  const [erroApartamentos, setErroApartamentos] = useState<string | null>(null);
  const [listaApartamentosAberta, setListaApartamentosAberta] = useState(false);
  const [opcaoApartamentoAtiva, setOpcaoApartamentoAtiva] = useState(-1);
  const [tentativaBuscaApartamento, setTentativaBuscaApartamento] = useState(0);
  const [tipoItemRetirada, setTipoItemRetirada] = useState<TipoItemControleChaves>('APARTAMENTO');
  const [buscaFerramenta, setBuscaFerramenta] = useState('');
  const [ferramentas, setFerramentas] = useState<FerramentaControleChaves[]>([]);
  const [ferramentaSelecionada, setFerramentaSelecionada] = useState<FerramentaControleChaves | null>(null);
  const [carregandoFerramentas, setCarregandoFerramentas] = useState(false);
  const [erroFerramentas, setErroFerramentas] = useState<string | null>(null);
  const [listaFerramentasAberta, setListaFerramentasAberta] = useState(false);
  const [opcaoFerramentaAtiva, setOpcaoFerramentaAtiva] = useState(-1);
  const [tentativaBuscaFerramenta, setTentativaBuscaFerramenta] = useState(0);
  const [idRetirante, setIdRetirante] = useState<number | null>(null);
  const [idLiberador, setIdLiberador] = useState<number | null>(null);
  const [salvandoRetirada, setSalvandoRetirada] = useState(false);
  const apartamentoListboxId = useId();
  const ferramentaListboxId = useId();

  // Estado do formulário de colaborador
  const [formData, setFormData] = useState<Colaborador>({
    nmColaborador: '',
    nrCelular: '',
    idEmpresa: 0,
    idCargo: 0,
    idPermissao: 0
  });

  const retiradas = useMemo(() => (dashboard?.retiradasRecentes ?? []).filter(retiradaAberta), [dashboard?.retiradasRecentes]);
  const retiradasChaves = useMemo(() => retiradas.filter(r => r.nmTipoItem !== 'FERRAMENTA'), [retiradas]);
  const retiradasFerramentas = useMemo(() => retiradas.filter(r => r.nmTipoItem === 'FERRAMENTA'), [retiradas]);

  const carregarColaboradores = async (mostrarErroNoModal = false) => {
    setCarregandoColaboradores(true);
    setErroColaboradores(null);
    try {
      const dados = await ColaboradorService.listar();
      setColaboradores(Array.isArray(dados) ? dados : []);
    } catch (err) {
      console.error("Erro ao carregar colaboradores:", err);
      setColaboradores([]);
      const mensagem = err instanceof Error ? err.message : 'Erro ao carregar colaboradores.';
      setErroColaboradores(mensagem);
      if (mostrarErroNoModal) setErroModal(mensagem);
    } finally {
      setCarregandoColaboradores(false);
    }
  };

  const carregarOpcoes = async () => {
    setCarregandoOpcoes(true);
    setErroOpcoes(null);
    try {
      const [novasEmpresas, novosCargos, novasPermissoes] = await Promise.all([
        OpcoesColaboradorService.listarEmpresas(),
        OpcoesColaboradorService.listarCargos(),
        OpcoesColaboradorService.listarPermissoes(),
      ]);
      setEmpresas(novasEmpresas);
      setCargos(novosCargos);
      setPermissoes(novasPermissoes);

      const listasVazias = [
        novasEmpresas.length === 0 && 'empresas',
        novosCargos.length === 0 && 'cargos',
        novasPermissoes.length === 0 && 'permissões',
      ].filter(Boolean);
      if (listasVazias.length) {
        setErroOpcoes(`Nenhuma opção encontrada para: ${listasVazias.join(', ')}.`);
      }
    } catch (err) {
      setEmpresas([]);
      setCargos([]);
      setPermissoes([]);
      setErroOpcoes(err instanceof Error ? err.message : 'Erro ao carregar as opções do colaborador.');
    } finally {
      setCarregandoOpcoes(false);
    }
  };

  const carregarDashboard = useCallback(async () => {
    setCarregandoDashboard(true);
    setErroDashboard(null);
    try {
      const [todosApartamentos, todasRetiradas, ferramentasAtivas] = await Promise.all([
        apartamentoVistoriaService.listar(),
        (async () => {
          const limite = 100;
          const registros: RetiradaControleChaves[] = [];
          let pagina = 0;
          let lote: RetiradaControleChaves[] = [];
          do {
            lote = await ControleChavesService.listarHistorico({ limite, pagina });
            registros.push(...lote);
            pagina += 1;
          } while (lote.length === limite);
          return registros;
        })(),
        idObra ? Promise.resolve([] as FerramentaControleChaves[]) : listarFerramentasAtivas(),
      ]);
      const apartamentosDaObra = todosApartamentos.filter(apartamento =>
        apartamentoPertenceAObra(apartamento.nmApartamentoVistoria, idObra));
      const retiradasDaObra = todasRetiradas.filter(retirada =>
        apartamentoPertenceAObra(retirada.apartamentoControleChavesDto?.nmApartamentoVistoria ?? '', idObra));
      const retiradasAbertas = retiradasDaObra.filter(retiradaAberta);
      const ferramentasEmCampo = new Set(retiradasAbertas
        .filter(retirada => retirada.nmTipoItem === 'FERRAMENTA')
        .map(retirada => retirada.ferramentaControleChavesDto?.idFerramenta)
        .filter((id): id is number => id !== undefined));

      setDashboard({
        qtChavesEmCampo: retiradasAbertas.length,
        qtChavesNoQuadro: apartamentosDaObra.filter(apartamento => !apartamentoEntregue(apartamento.nmStatusVistoria)).length
          + ferramentasAtivas.filter(ferramenta => !ferramentasEmCampo.has(ferramenta.idFerramenta)).length,
        qtChavesEntregues: apartamentosDaObra.filter(apartamento => apartamentoEntregue(apartamento.nmStatusVistoria)).length,
        retiradasRecentes: retiradasAbertas
          .sort((a, b) => (normalizarData(b.dtRetirada) ?? 0) - (normalizarData(a.dtRetirada) ?? 0)),
      });
    }
    catch (err) {
      setDashboard(null);
      setErroDashboard(err instanceof Error ? err.message : 'Falha ao carregar o dashboard.');
    } finally { setCarregandoDashboard(false); }
  }, [idObra]);

  useEffect(() => {
    carregarColaboradores();
    carregarOpcoes();
  }, []);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    const atualizarObra = () => setIdObra(lerObraControleChaves());
    window.addEventListener(EVENTO_OBRA_CONTROLE_CHAVES, atualizarObra);
    window.addEventListener('storage', atualizarObra);
    return () => {
      window.removeEventListener(EVENTO_OBRA_CONTROLE_CHAVES, atualizarObra);
      window.removeEventListener('storage', atualizarObra);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setFiltrosHistorico({});
  }, [idObra]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarregandoHistorico(true);
      setErroHistorico(null);
      try {
        const limiteConsulta = 100;
        const registros: RetiradaControleChaves[] = [];
        let pagina = 0;
        do {
          const lote = await ControleChavesService.listarHistorico({
            busca: buscaHistorico.trim(), status: statusHistorico,
            idObra, limite: limiteConsulta, pagina, signal: controller.signal,
          });
          registros.push(...lote);
          if (lote.length < limiteConsulta) break;
          pagina += 1;
        } while (!controller.signal.aborted);
        setHistorico(registros);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHistorico([]);
        setErroHistorico(err instanceof Error ? err.message : 'Falha ao carregar o histórico.');
      } finally { if (!controller.signal.aborted) setCarregandoHistorico(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [buscaHistorico, statusHistorico, idObra, tentativaHistorico]);

  useEffect(() => {
    if (modalType !== 'retirada' || tipoItemRetirada !== 'APARTAMENTO') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarregandoApartamentos(true);
      setErroApartamentos(null);
      try {
        const dados = await ControleChavesService.listarApartamentos(buscaApartamento.trim(), { limite: 20, pagina: 0, signal: controller.signal });
        setApartamentos(dados);
        setErroApartamentos(null);
        setOpcaoApartamentoAtiva(dados.length ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setApartamentos([]);
        setErroApartamentos(err instanceof Error ? err.message : 'Falha ao buscar apartamentos.');
      } finally {
        if (!controller.signal.aborted) setCarregandoApartamentos(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [buscaApartamento, modalType, tipoItemRetirada, tentativaBuscaApartamento]);

  useEffect(() => {
    if (modalType !== 'retirada' || tipoItemRetirada !== 'FERRAMENTA') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarregandoFerramentas(true);
      setErroFerramentas(null);
      try {
        const dados = await ControleChavesService.listarFerramentas(buscaFerramenta.trim(), { limite: 20, pagina: 0, signal: controller.signal });
        setFerramentas(dados);
        setErroFerramentas(null);
        setOpcaoFerramentaAtiva(dados.length ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFerramentas([]);
        setErroFerramentas(err instanceof Error ? err.message : 'Falha ao buscar ferramentas.');
      } finally {
        if (!controller.signal.aborted) setCarregandoFerramentas(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [buscaFerramenta, modalType, tipoItemRetirada, tentativaBuscaFerramenta]);

  const valoresPorColuna = useMemo(() => Object.fromEntries(
    (['codigo', 'data', 'apartamento', 'retirante', 'recebedor', 'status'] as ColunaHistorico[]).map(coluna => [
      coluna,
      [...new Set(historico.map(item => valorColunaHistorico(item, coluna)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    ]),
  ) as Record<ColunaHistorico, string[]>, [historico]);

  const historicoFiltrado = useMemo(() => {
    const filtrados = historico.filter(item => Object.entries(filtrosHistorico).every(([coluna, selecionados]) =>
      selecionados?.includes(valorColunaHistorico(item, coluna as ColunaHistorico))));
    return filtrados.sort((a, b) => {
      if (!ordenacaoHistorico) return Number(retiradaAberta(b)) - Number(retiradaAberta(a));
      return ordenacaoHistorico.coluna === 'data'
        ? compararValores(a?.dtRetirada, b?.dtRetirada, ordenacaoHistorico.direcao, true)
        : compararValores(valorColunaHistorico(a, ordenacaoHistorico.coluna), valorColunaHistorico(b, ordenacaoHistorico.coluna), ordenacaoHistorico.direcao);
    });
  }, [historico, filtrosHistorico, ordenacaoHistorico]);
  const totalHistorico = historicoFiltrado.length;
  const historicoPaginado = itemsPerPage === 'todos' ? historicoFiltrado : historicoFiltrado.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const historicoVazio = !carregandoHistorico && !erroHistorico && historicoPaginado.length === 0;
  const temProximaPagina = itemsPerPage !== 'todos' && currentPage * itemsPerPage < totalHistorico;
  const configurarFiltro = (coluna: ColunaHistorico, valores: string[] | null) => {
    setFiltrosHistorico(atuais => {
      const proximos = { ...atuais };
      if (valores === null) delete proximos[coluna]; else proximos[coluna] = valores;
      return proximos;
    });
    setCurrentPage(1);
  };

  const fecharModal = () => {
    setModalType(null);
    setEditingColab(null);
    setErroModal(null);
    setIdRecebedor(null);
  };

  const openModal = (type: string, colab: ModalItem | null = null) => {
    setModalType(type);
    setEditingColab(colab);
    setErroModal(null);
    setIdRecebedor(null);

    if (type === 'retirada') {
      setTipoItemRetirada('APARTAMENTO');
      setBuscaApartamento('');
      setApartamentoSelecionado(null);
      setApartamentos([]);
      setErroApartamentos(null);
      setListaApartamentosAberta(false);
      setBuscaFerramenta('');
      setFerramentaSelecionada(null);
      setFerramentas([]);
      setErroFerramentas(null);
      setListaFerramentasAberta(false);
      setIdRetirante(null);
      setIdLiberador(null);
      setSalvandoRetirada(false);
      void carregarColaboradores(true);
    }

    if (type === 'confirmar') void carregarColaboradores(true);

    if (type === 'colaborador' || type === 'editarColaborador') {
      if (colab && 'nmColaborador' in colab) {
        setFormData({
          id: colab.id,
          nmColaborador: colab.nmColaborador || '',
          nrCelular: colab.nrCelular || '',
          idEmpresa: colab.idEmpresa ?? 0,
          idCargo: colab.idCargo ?? 0,
          idPermissao: colab.idPermissao ?? 0,
        });
      } else {
        setFormData({
          nmColaborador: '',
          nrCelular: '',
          idEmpresa: empresas[0]?.id ?? 0,
          idCargo: cargos[0]?.id ?? 0,
          idPermissao: permissoes[0]?.id ?? 0,
        });
      }
    }
  };

  const handleSalvarColaborador = async () => {
    setErroModal(null);
    if (!formData.nmColaborador.trim() || !formData.nrCelular.trim() || !formData.idEmpresa || !formData.idCargo || !formData.idPermissao) {
      setErroModal('Preencha nome, celular, empresa, cargo e permissão.');
      return;
    }
    setSalvandoColaborador(true);
    try {
      await ColaboradorService.salvar(formData);
      await carregarColaboradores();
      fecharModal();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar colaborador no banco.');
    } finally {
      setSalvandoColaborador(false);
    }
  };

  const retiradaSelecionada = editingColab && 'cdCodigoRetirada' in editingColab ? editingColab : null;

  const handleCriarRetirada = async () => {
    if (salvandoRetirada) return;
    setErroModal(null);
    if (idRetirante === null || idLiberador === null) {
      setErroModal('Selecione quem retirou e quem liberou.');
      return;
    }
    if (tipoItemRetirada === 'APARTAMENTO' && !apartamentoSelecionado) {
      setErroModal('Selecione o apartamento.');
      return;
    }
    if (tipoItemRetirada === 'FERRAMENTA' && !ferramentaSelecionada) {
      setErroModal('Selecione a ferramenta.');
      return;
    }
    setSalvandoRetirada(true);
    try {
      await ControleChavesService.criarRetirada({
        nmTipoItem: tipoItemRetirada,
        idApartamentoVistoria: tipoItemRetirada === 'APARTAMENTO' ? apartamentoSelecionado?.idApartamentoVistoria : undefined,
        idFerramenta: tipoItemRetirada === 'FERRAMENTA' ? ferramentaSelecionada?.idFerramenta : undefined,
        idUserRetirada: idRetirante,
        idUserLiberacao: idLiberador,
      });
      fecharModal();
      await Promise.all([carregarDashboard(), carregarColaboradores()]);
      setTentativaHistorico(value => value + 1);
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Falha ao criar retirada.');
    } finally {
      setSalvandoRetirada(false);
    }
  };

  const handleReceberRetirada = async () => {
    if (!retiradaSelecionada || recebendoId !== null) return;
    setErroModal(null);
    if (idRecebedor === null) {
      setErroModal('Selecione quem recebeu a chave.');
      return;
    }
    setRecebendoId(retiradaSelecionada.idRequisicao);
    try {
      await ControleChavesService.receberRetirada(retiradaSelecionada.idRequisicao, { idUserRecebimento: idRecebedor });
      setDashboard(atual => atual ? {
        ...atual,
        qtChavesEmCampo: Math.max(0, atual.qtChavesEmCampo - 1),
        qtChavesNoQuadro: atual.qtChavesNoQuadro + 1,
        qtChavesEntregues: atual.qtChavesEntregues + (retiradaSelecionada.nmTipoItem === 'APARTAMENTO' ? 1 : 0),
        retiradasRecentes: atual.retiradasRecentes.filter(item => item.idRequisicao !== retiradaSelecionada.idRequisicao),
      } : atual);
      fecharModal();
      await Promise.all([carregarDashboard(), carregarColaboradores()]);
      setTentativaHistorico(value => value + 1);
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Falha ao confirmar recebimento.');
    } finally { setRecebendoId(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-slate-900 text-white shadow-xl rounded-2xl max-w-7xl mx-auto mb-8">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-black flex items-center gap-2 text-emerald-400 tracking-tight">
            <Key className="w-6 h-6" /> Controle de Chaves
          </h1>
          <nav className="flex flex-wrap gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'colaboradores', label: 'Colaboradores', icon: Users },
              { id: 'historico', label: 'Histórico', icon: Archive }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: "Chaves em Campo", value: dashboard?.qtChavesEmCampo, color: "text-amber-500", icon: Clock },
                { label: "Chaves no Quadro", value: dashboard?.qtChavesNoQuadro, color: "text-emerald-500", icon: Box },
                { label: "Chaves Entregues", value: dashboard?.qtChavesEntregues, color: "text-blue-500", icon: CheckCircle }
              ].map((card, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
                  <p className="text-slate-400 flex items-center gap-2 text-xs uppercase font-extrabold tracking-widest">
                    <card.icon size={16} /> {card.label}
                  </p>
                  <p className={`text-4xl font-black ${card.color} mt-2`}>{carregandoDashboard ? '…' : card.value ?? '—'}</p>
                </div>
              ))}
            </div>
            {erroDashboard && <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{erroDashboard}</span><button onClick={() => void carregarDashboard()} className="font-semibold">Tentar novamente</button></div>}

            <div className="flex flex-wrap justify-between items-center gap-4">
              <h3 className="font-bold text-lg text-slate-800">Retiradas em aberto</h3>
              <button
                onClick={() => openModal('retirada')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-semibold text-sm shadow-md shadow-emerald-500/20"
              >
                <PlusCircle size={18} /> Nova Retirada
              </button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <TabelaRetiradasAbertas key={`chaves-${idObra}`} titulo="Chaves" itens={retiradasChaves} carregando={carregandoDashboard} erro={!!erroDashboard} recebendoId={recebendoId} onReceber={r => openModal('confirmar', r)} />
              <TabelaRetiradasAbertas key={`ferramentas-${idObra}`} titulo="Ferramentas" itens={retiradasFerramentas} carregando={carregandoDashboard} erro={!!erroDashboard} recebendoId={recebendoId} onReceber={r => openModal('confirmar', r)} />
            </div>
          </div>
        )}

        {activeTab === 'colaboradores' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h3 className="font-bold text-lg text-slate-800">Colaboradores</h3>
              <button
                onClick={() => openModal('colaborador')}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-all font-semibold text-sm"
              >
                <PlusCircle size={18} /> Cadastrar
              </button>
            </div>

            <div className="min-w-[600px]">
              {carregandoColaboradores && (
                <p className="py-4 text-sm text-slate-500">Carregando colaboradores...</p>
              )}
              {erroColaboradores && !modalType && (
                <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <span>{erroColaboradores}</span>
                  <button onClick={() => void carregarColaboradores()} className="font-semibold hover:text-red-900">Tentar novamente</button>
                </div>
              )}
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                    <th className="pb-3">Nome</th>
                    <th className="pb-3">Empresa</th>
                    <th className="pb-3">Cargo</th>
                    <th className="pb-3">Celular</th>
                    <th className="pb-3">Permissão</th>
                    <th className="pb-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-slate-800 font-semibold text-sm">{c.nmColaborador}</td>
                      <td className="py-4 text-slate-600 text-sm">{c.nmEmpresa || `Empresa ${c.idEmpresa}`}</td>
                      <td className="py-4 text-slate-600 text-sm">{c.nmCargo || `Cargo ${c.idCargo}`}</td>
                      <td className="py-4 text-slate-600 font-mono text-xs">{c.nrCelular}</td>
                      <td className="py-4 text-slate-600 text-sm">{c.nmPermissao || `Permissão ${c.idPermissao}`}</td>
                      <td className="py-4">
                        <button onClick={() => openModal('editarColaborador', c)} className="text-emerald-600 hover:text-emerald-800">
                          <Edit2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-bold text-lg text-slate-800">Histórico de Retiradas</h3>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <select value={statusHistorico} onChange={e => { setStatusHistorico(e.target.value); setCurrentPage(1); }} className="border border-slate-200 rounded-xl py-2 px-3 text-sm bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos</option>
                  <option value="ABERTO">Aberta</option>
                  <option value="RECEBIDO">Recebida</option>
                </select>

                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={buscaHistorico}
                    onChange={e => { setBuscaHistorico(e.target.value); setCurrentPage(1); }}
                    placeholder="Pesquisar..."
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-full text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={itemsPerPage}
                  className="border border-slate-200 rounded-xl py-2 px-3 text-sm bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  onChange={(e) => {
                    setItemsPerPage(e.target.value === 'todos' ? 'todos' : Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="20">20 itens</option>
                  <option value="50">50 itens</option>
                  <option value="100">100 itens</option>
                  <option value="todos">Todos</option>
                </select>

                {itemsPerPage !== 'todos' ? <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <span>Página {currentPage}</span>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><ChevronLeft size={16} /></button>
                  <button disabled={!temProximaPagina} onClick={() => setCurrentPage(p => p + 1)} className="p-1 disabled:opacity-40 hover:bg-slate-200 rounded-lg transition-colors"><ChevronRight size={16} /></button>
                </div> : <span className="text-xs font-semibold text-slate-600">{totalHistorico} itens</span>}
              </div>
            </div>

            <div className={`${historicoVazio ? 'overflow-visible' : 'overflow-x-auto'} min-w-full`}>
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                    {([
                      ['codigo', 'Código'],
                      ['data', 'Data'],
                      ['apartamento', 'Item'],
                      ['retirante', 'Retirado por'],
                      ['recebedor', 'Recebido por'],
                      ['status', 'Status'],
                    ] as [ColunaHistorico, string][]).map(([coluna, label]) => (
                      <th key={coluna} className="pb-3">
                        <HistoricoColumnFilter
                          label={label}
                          values={valoresPorColuna[coluna]}
                          selected={filtrosHistorico[coluna] ?? null}
                          sortDirection={ordenacaoHistorico?.coluna === coluna ? ordenacaoHistorico.direcao : null}
                          onApply={valores => configurarFiltro(coluna, valores)}
                          onSort={direcao => { setOrdenacaoHistorico({ coluna, direcao }); setCurrentPage(1); }}
                        />
                      </th>
                    ))}
                    <th className="pb-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoHistorico && <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">Carregando histórico...</td></tr>}
                  {erroHistorico && <tr><td colSpan={7} className="py-8 text-center text-sm text-red-700">{erroHistorico} <button onClick={() => setTentativaHistorico(v => v + 1)} className="ml-2 font-semibold underline">Tentar novamente</button></td></tr>}
                  {historicoPaginado.map(r => {
                    const aberta = retiradaAberta(r);
                    return (
                    <tr key={r.idRequisicao} className={`border-b transition-colors ${aberta ? 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/50' : 'border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70'}`}>
                      <td className="py-4 font-mono font-bold text-slate-400 text-sm">{valorColunaHistorico(r, 'codigo')}</td>
                      <td className="py-4 text-slate-500 text-sm">{valorColunaHistorico(r, 'data')}</td>
                      <td className="py-4 text-slate-700 font-mono text-sm">{valorColunaHistorico(r, 'apartamento')}</td>
                      <td className="py-4 text-slate-500 text-sm">{valorColunaHistorico(r, 'retirante')}</td>
                      <td className="py-4 text-slate-500 text-sm">{valorColunaHistorico(r, 'recebedor')}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${aberta ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{valorColunaHistorico(r, 'status')}</span>
                      </td>
                      <td className="py-4">
                        {aberta && <button onClick={() => openModal('confirmar', r)} title="Confirmar recebimento" className="text-emerald-600 hover:text-emerald-800 transition-colors"><CheckCircle size={18} /></button>}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {historicoVazio && (
                <div className="flex min-h-32 items-center justify-center border-t border-slate-100 px-4 text-center text-sm text-slate-500">
                  Nenhum registro encontrado.
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {modalType === 'retirada' ? 'Nova Retirada' : modalType === 'confirmar' ? 'Confirmar Recebimento' : modalType === 'editarRetirada' ? 'Editar Retirada' : 'Dados do Colaborador'}
              </h2>
              <button onClick={fecharModal} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <div className="space-y-4">
              {erroModal && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erroModal}
                </div>
              )}
              {modalType === 'colaborador' || modalType === 'editarColaborador' ? (
                <>
                  {carregandoOpcoes && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Carregando opções...</p>
                  )}
                  {erroOpcoes && !carregandoOpcoes && (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <span>{erroOpcoes}</span>
                      <button onClick={carregarOpcoes} className="shrink-0 font-semibold hover:text-red-900">Tentar novamente</button>
                    </div>
                  )}
                  <label className="block text-sm font-semibold text-slate-600">Nome Completo</label>
                  <input
                    value={formData.nmColaborador}
                    onChange={e => setFormData({...formData, nmColaborador: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <label className="block text-sm font-semibold text-slate-600">Celular</label>
                  <input
                    value={formData.nrCelular}
                    onChange={e => setFormData({...formData, nrCelular: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <label className="block text-sm font-semibold text-slate-600">Empresa</label>
                  <select
                    value={formData.idEmpresa}
                    onChange={e => setFormData({...formData, idEmpresa: Number(e.target.value)})}
                    disabled={carregandoOpcoes || empresas.length === 0}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0} disabled>Selecione uma empresa</option>
                    {empresas.map(empresa => <option key={empresa.id} value={empresa.id}>{empresa.nmEmpresa}</option>)}
                  </select>
                  <label className="block text-sm font-semibold text-slate-600">Cargo</label>
                  <select
                    value={formData.idCargo}
                    onChange={e => setFormData({...formData, idCargo: Number(e.target.value)})}
                    disabled={carregandoOpcoes || cargos.length === 0}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0} disabled>Selecione um cargo</option>
                    {cargos.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.nmCargo}</option>)}
                  </select>
                  <label className="block text-sm font-semibold text-slate-600">Permissão</label>
                  <select
                    value={formData.idPermissao}
                    onChange={e => setFormData({...formData, idPermissao: Number(e.target.value)})}
                    disabled={carregandoOpcoes || permissoes.length === 0}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0} disabled>Selecione uma permissão</option>
                    {permissoes.map(permissao => <option key={permissao.id} value={permissao.id}>{permissao.nmPermissao}</option>)}
                  </select>
                  <button
                    onClick={handleSalvarColaborador}
                    disabled={salvandoColaborador || carregandoOpcoes || !!erroOpcoes}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4 transition-colors"
                  >
                    {salvandoColaborador ? 'Salvando...' : 'Confirmar'}
                  </button>
                </>
              ) : modalType === 'retirada' ? (
                <>
                  <label className="block text-sm font-semibold text-slate-600">Tipo de item</label>
                  <div className="mb-1 flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setTipoItemRetirada('APARTAMENTO')}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tipoItemRetirada === 'APARTAMENTO' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                    >Apartamento</button>
                    <button
                      type="button"
                      onClick={() => setTipoItemRetirada('FERRAMENTA')}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tipoItemRetirada === 'FERRAMENTA' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                    >Ferramenta</button>
                  </div>
                  {tipoItemRetirada === 'APARTAMENTO' ? (
                  <>
                  <label htmlFor="busca-apartamento" className="block text-sm font-semibold text-slate-600">Apartamento</label>
                  <div className="relative">
                    <input
                      id="busca-apartamento"
                      type="search"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={listaApartamentosAberta}
                      aria-controls={apartamentoListboxId}
                      aria-activedescendant={opcaoApartamentoAtiva >= 0 ? `${apartamentoListboxId}-${opcaoApartamentoAtiva}` : undefined}
                      value={buscaApartamento}
                      placeholder="Pesquisar apartamento..."
                      autoComplete="off"
                      onFocus={() => setListaApartamentosAberta(true)}
                      onChange={(event) => {
                        setBuscaApartamento(event.target.value);
                        setApartamentoSelecionado(null);
                        setListaApartamentosAberta(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setListaApartamentosAberta(true);
                          setOpcaoApartamentoAtiva(index => Math.min(index + 1, apartamentos.length - 1));
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setOpcaoApartamentoAtiva(index => Math.max(index - 1, 0));
                        } else if (event.key === 'Enter' && opcaoApartamentoAtiva >= 0 && apartamentos[opcaoApartamentoAtiva]) {
                          event.preventDefault();
                          const apartamento = apartamentos[opcaoApartamentoAtiva];
                          setApartamentoSelecionado(apartamento);
                          setBuscaApartamento(apartamento.nmApartamentoVistoria);
                          setErroApartamentos(null);
                          setListaApartamentosAberta(false);
                        } else if (event.key === 'Escape') {
                          setListaApartamentosAberta(false);
                        }
                      }}
                      className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {buscaApartamento && (
                      <button type="button" aria-label="Limpar apartamento" onClick={() => {
                        setBuscaApartamento('');
                        setApartamentoSelecionado(null);
                        setListaApartamentosAberta(true);
                      }} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"><X size={18} /></button>
                    )}
                    {listaApartamentosAberta && !carregandoApartamentos && !erroApartamentos && apartamentos.length > 0 && (
                      <ul id={apartamentoListboxId} role="listbox" className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        {apartamentos.map((apartamento, index) => (
                          <li
                            id={`${apartamentoListboxId}-${index}`}
                            key={apartamento.idApartamentoVistoria}
                            role="option"
                            aria-selected={apartamentoSelecionado?.idApartamentoVistoria === apartamento.idApartamentoVistoria}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setApartamentoSelecionado(apartamento);
                              setBuscaApartamento(apartamento.nmApartamentoVistoria);
                              setErroApartamentos(null);
                              setListaApartamentosAberta(false);
                            }}
                            className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === opcaoApartamentoAtiva ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}
                          >{apartamento.nmApartamentoVistoria}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {listaApartamentosAberta && carregandoApartamentos && <p className="text-sm text-slate-500">Buscando apartamentos...</p>}
                  {listaApartamentosAberta && !carregandoApartamentos && !erroApartamentos && apartamentos.length === 0 && <p className="text-sm text-slate-500">Nenhum apartamento encontrado.</p>}
                  {listaApartamentosAberta && erroApartamentos && !carregandoApartamentos && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span>{erroApartamentos}</span>
                      <button type="button" onClick={() => setTentativaBuscaApartamento(value => value + 1)} className="shrink-0 font-semibold hover:text-red-900">Tentar novamente</button>
                    </div>
                  )}
                  </>
                  ) : (
                  <>
                  <label htmlFor="busca-ferramenta" className="block text-sm font-semibold text-slate-600">Ferramenta</label>
                  <div className="relative">
                    <input
                      id="busca-ferramenta"
                      type="search"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={listaFerramentasAberta}
                      aria-controls={ferramentaListboxId}
                      aria-activedescendant={opcaoFerramentaAtiva >= 0 ? `${ferramentaListboxId}-${opcaoFerramentaAtiva}` : undefined}
                      value={buscaFerramenta}
                      placeholder="Pesquisar ferramenta..."
                      autoComplete="off"
                      onFocus={() => setListaFerramentasAberta(true)}
                      onChange={(event) => {
                        setBuscaFerramenta(event.target.value);
                        setFerramentaSelecionada(null);
                        setListaFerramentasAberta(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setListaFerramentasAberta(true);
                          setOpcaoFerramentaAtiva(index => Math.min(index + 1, ferramentas.length - 1));
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setOpcaoFerramentaAtiva(index => Math.max(index - 1, 0));
                        } else if (event.key === 'Enter' && opcaoFerramentaAtiva >= 0 && ferramentas[opcaoFerramentaAtiva]) {
                          event.preventDefault();
                          const ferramenta = ferramentas[opcaoFerramentaAtiva];
                          setFerramentaSelecionada(ferramenta);
                          setBuscaFerramenta(ferramenta.nmFerramenta);
                          setErroFerramentas(null);
                          setListaFerramentasAberta(false);
                        } else if (event.key === 'Escape') {
                          setListaFerramentasAberta(false);
                        }
                      }}
                      className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {buscaFerramenta && (
                      <button type="button" aria-label="Limpar ferramenta" onClick={() => {
                        setBuscaFerramenta('');
                        setFerramentaSelecionada(null);
                        setListaFerramentasAberta(true);
                      }} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"><X size={18} /></button>
                    )}
                    {listaFerramentasAberta && !carregandoFerramentas && !erroFerramentas && ferramentas.length > 0 && (
                      <ul id={ferramentaListboxId} role="listbox" className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        {ferramentas.map((ferramenta, index) => (
                          <li
                            id={`${ferramentaListboxId}-${index}`}
                            key={ferramenta.idFerramenta}
                            role="option"
                            aria-selected={ferramentaSelecionada?.idFerramenta === ferramenta.idFerramenta}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setFerramentaSelecionada(ferramenta);
                              setBuscaFerramenta(ferramenta.nmFerramenta);
                              setErroFerramentas(null);
                              setListaFerramentasAberta(false);
                            }}
                            className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === opcaoFerramentaAtiva ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}
                          >{ferramenta.nmFerramenta}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {listaFerramentasAberta && carregandoFerramentas && <p className="text-sm text-slate-500">Buscando ferramentas...</p>}
                  {listaFerramentasAberta && !carregandoFerramentas && !erroFerramentas && ferramentas.length === 0 && <p className="text-sm text-slate-500">Nenhuma ferramenta encontrada.</p>}
                  {listaFerramentasAberta && erroFerramentas && !carregandoFerramentas && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span>{erroFerramentas}</span>
                      <button type="button" onClick={() => setTentativaBuscaFerramenta(value => value + 1)} className="shrink-0 font-semibold hover:text-red-900">Tentar novamente</button>
                    </div>
                  )}
                  </>
                  )}
                  <label className="block text-sm font-semibold text-slate-600">Retirado Por</label>
                  <select value={idRetirante ?? ''} onChange={(event) => setIdRetirante(Number(event.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="" disabled>Selecione quem retirou</option>
                    {colaboradores.filter(podeRetirarChave).map(c => <option key={c.id} value={c.id}>{c.nmColaborador}</option>)}
                  </select>
                  <label className="block text-sm font-semibold text-slate-600">Liberado Por</label>
                  <select value={idLiberador ?? ''} onChange={(event) => setIdLiberador(Number(event.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="" disabled>Selecione quem liberou</option>
                    {colaboradores.filter(podeLiberarChave).map(c => <option key={c.id} value={c.id}>{c.nmColaborador}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleCriarRetirada}
                    disabled={salvandoRetirada}
                    className="w-full bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4"
                  >{salvandoRetirada ? 'Confirmando...' : 'Confirmar'}</button>
                </>
              ) : modalType === 'confirmar' ? (
                <>
                  <p className="text-slate-600">Confirma o recebimento da retirada <strong className="text-slate-900">{retiradaSelecionada?.cdCodigoRetirada}</strong>, apartamento <strong className="text-slate-900">{retiradaSelecionada?.apartamentoControleChavesDto?.nmApartamentoVistoria ?? retiradaSelecionada?.ferramentaControleChavesDto?.nmFerramenta}</strong>?</p>
                  <label className="block text-sm font-semibold text-slate-600">Recebido Por</label>
                  <select value={idRecebedor ?? ''} onChange={(event) => { setIdRecebedor(Number(event.target.value)); setErroModal(null); }} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="" disabled>Selecione quem recebeu</option>
                    {colaboradores.filter(podeLiberarChave).map(c => <option key={c.id} value={c.id}>{c.nmColaborador}</option>)}
                  </select>
                  <button disabled={recebendoId !== null} onClick={handleReceberRetirada} className="w-full bg-slate-900 disabled:opacity-50 hover:bg-slate-800 text-white font-bold py-3 rounded-xl mt-4 transition-colors">{recebendoId !== null ? 'Confirmando...' : 'Confirmar'}</button>
                </>
              ) : modalType === 'editarRetirada' ? (
                <>
                  <label className="block text-sm font-semibold text-slate-600">Apartamento</label>
                  <input readOnly defaultValue={retiradaSelecionada?.apartamentoControleChavesDto?.nmApartamentoVistoria ?? retiradaSelecionada?.ferramentaControleChavesDto?.nmFerramenta} className="w-full p-3 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl cursor-not-allowed" />
                  <label className="block text-sm font-semibold text-slate-600">Retirado Por</label>
                  <input readOnly defaultValue={retiradaSelecionada?.retiranteControleChavesDto.nmPessoaRetirante} className="w-full p-3 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl cursor-not-allowed" />
                  <label className="block text-sm font-semibold text-slate-600">Status</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Em campo</option>
                    <option>Recebida</option>
                  </select>
                  <button onClick={fecharModal} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl mt-4 transition-colors">Confirmar</button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
