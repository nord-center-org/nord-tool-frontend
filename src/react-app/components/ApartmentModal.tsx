import { useCallback, useState } from "react";
import { X } from "lucide-react";

import type {
  ApartamentoVistoriaDto,
  ApartamentoVistoriaForm,
} from "@/shared/types";

import ApartmentDadosTab from "@/react-app/components/ApartmentDadosTab";
import TermoReprovaTab from "@/react-app/components/termo/TermoReprovaTab";

export type AbaApartamento = "dados" | "termo";

interface ApartmentModalProps {
  apartment: ApartamentoVistoriaDto | null;
  onClose: () => void;
  onSave: (data: ApartamentoVistoriaForm) => void;
  /** Aba aberta inicialmente (ex.: "termo" ao clicar na coluna Termo da lista). */
  abaInicial?: AbaApartamento;
}

const MSG_DESCARTAR = "Há alterações não salvas. Deseja descartá-las?";

/** Casca do modal: abas "Dados" e "Termo de reprova". */
export default function ApartmentModal({
  apartment,
  onClose,
  onSave,
  abaInicial = "dados",
}: ApartmentModalProps) {
  const salvo = Boolean(apartment?.idApartamentoVistoria);
  const [aba, setAba] = useState<AbaApartamento>(abaInicial === "termo" && salvo ? "termo" : "dados");
  // A aba do termo só é montada (e o pdf.js só carregado) na primeira visita; depois fica montada
  // para não perder o que foi digitado ao alternar entre as abas.
  const [termoVisitada, setTermoVisitada] = useState(abaInicial === "termo" && salvo);
  const [dadosSujo, setDadosSujo] = useState(false);
  const [termoSujo, setTermoSujo] = useState(false);

  const handleDadosSujo = useCallback((sujo: boolean) => setDadosSujo(sujo), []);
  const handleTermoSujo = useCallback((sujo: boolean) => setTermoSujo(sujo), []);

  const tentarFechar = () => {
    if ((dadosSujo || termoSujo) && !window.confirm(MSG_DESCARTAR)) return;
    onClose();
  };

  const abrirAba = (destino: AbaApartamento) => {
    if (destino === "termo") {
      if (!salvo) return;
      setTermoVisitada(true);
    }
    setAba(destino);
  };

  const classeAba = (ativa: boolean, desabilitada = false) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${
      ativa
        ? "bg-blue-600 text-white shadow-sm"
        : desabilitada
          ? "text-slate-300 cursor-not-allowed"
          : "text-slate-500 hover:bg-slate-100"
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl flex flex-col overflow-hidden h-[90vh] md:h-[85vh] relative">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6">
          <div role="tablist" aria-label="Seções do apartamento" className="flex items-center gap-1">
            <button
              type="button"
              role="tab"
              id="aba-dados"
              aria-selected={aba === "dados"}
              aria-controls="painel-dados"
              onClick={() => abrirAba("dados")}
              className={classeAba(aba === "dados")}
            >
              Dados
            </button>
            <button
              type="button"
              role="tab"
              id="aba-termo"
              aria-selected={aba === "termo"}
              aria-controls="painel-termo"
              aria-disabled={!salvo}
              disabled={!salvo}
              title={salvo ? undefined : "Salve o apartamento para anexar o termo de reprova"}
              onClick={() => abrirAba("termo")}
              className={classeAba(aba === "termo", !salvo)}
            >
              Termo de reprova
            </button>
          </div>

          <button
            type="button"
            onClick={tentarFechar}
            aria-label="Fechar"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            role="tabpanel"
            id="painel-dados"
            aria-labelledby="aba-dados"
            hidden={aba !== "dados"}
            className="h-full"
          >
            <ApartmentDadosTab
              apartment={apartment}
              onClose={tentarFechar}
              onSave={onSave}
              onDirtyChange={handleDadosSujo}
            />
          </div>

          {salvo && termoVisitada && apartment && (
            <div
              role="tabpanel"
              id="painel-termo"
              aria-labelledby="aba-termo"
              hidden={aba !== "termo"}
              className="h-full"
            >
              <TermoReprovaTab
                apartamento={apartment}
                ativa={aba === "termo"}
                onDirtyChange={handleTermoSujo}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
