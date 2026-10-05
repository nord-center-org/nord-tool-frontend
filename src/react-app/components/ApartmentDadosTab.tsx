import { useEffect, useState } from "react";
import { apartamentoVistoriaService } from "@/react-app/services/ApartamentoVistoriaService";

import type {
  ApartamentoVistoriaDto,
  ApartamentoVistoriaForm,
  DiaSemanaDto,
  StatusVistoriaDto,
} from "@/shared/types";

import {
  listarDiasSemana,
  listarStatusVistoria,
} from "@/react-app/services/EndpointsDominioService";

interface ApartmentDadosTabProps {
  apartment: ApartamentoVistoriaDto | null;
  onClose: () => void;
  onSave: (data: ApartamentoVistoriaForm) => void;
  /** Informa ao modal se há edição não salva (aviso ao fechar). */
  onDirtyChange?: (sujo: boolean) => void;
}

const FORM_VAZIO: ApartamentoVistoriaForm = {
  nmApartamentoVistoria: "",
  idDiaSemana: 0,
  dtApartamentoVigente: "",
  nmHorarioVistoria: "",
  idStatusVistoria: 0,
  inMarcarRevistoria: false,
  txObservacaoRevistoria: "",
  dtRevistoriaVigente: "",
};

function formDoApartamento(apartment: ApartamentoVistoriaDto): ApartamentoVistoriaForm {
  let dataISO = apartment.dtApartamentoVigente ?? "";
  if (dataISO.includes('/')) {
    const [d, m, a] = dataISO.split('/');
    dataISO = `${a}-${m}-${d}`;
  } else if (dataISO.includes('T')) {
    dataISO = dataISO.split('T')[0];
  }
  return {
    idApartamentoVistoria: apartment.idApartamentoVistoria,
    nmApartamentoVistoria: apartment.nmApartamentoVistoria ?? "",
    idDiaSemana: Number(apartment.idDiaSemana) || 0,
    dtApartamentoVigente: dataISO,
    nmHorarioVistoria: apartment.nmHorarioVistoria ?? "",
    idStatusVistoria: Number(apartment.idStatusVistoria) || 0,
    inMarcarRevistoria: apartment.inMarcarRevistoria ?? false,
    txObservacaoRevistoria: apartment.txObservacaoRevistoria ?? "",
    dtRevistoriaVigente: apartment.dtRevistoriaVigente ?? "",
  };
}

/** Aba "Dados": o formulário de agendamento/vistoria, sem alteração de comportamento. */
export default function ApartmentDadosTab({
  apartment,
  onClose,
  onSave,
  onDirtyChange,
}: ApartmentDadosTabProps) {
  const [diasSemana, setDiasSemana] = useState<DiaSemanaDto[]>([]);
  const [statusList, setStatusList] = useState<StatusVistoriaDto[]>([]);

  const [formData, setFormData] = useState<ApartamentoVistoriaForm>(FORM_VAZIO);
  const [snapshot, setSnapshot] = useState<string>(() => JSON.stringify(FORM_VAZIO));

  useEffect(() => {
    Promise.all([
      listarDiasSemana().catch(() => []),
      listarStatusVistoria().catch(() => [])
    ]).then(([dias, status]) => {
      setDiasSemana(dias);
      setStatusList(status);
    });
  }, []);

  useEffect(() => {
    if (apartment) {
      const form = formDoApartamento(apartment);
      setFormData(form);
      setSnapshot(JSON.stringify(form));
    }
  }, [apartment]);

  const sujo = JSON.stringify(formData) !== snapshot;
  useEffect(() => {
    onDirtyChange?.(sujo);
  }, [sujo, onDirtyChange]);

  const handleDateChange = (novaData: string) => {
    const dataObj = new Date(novaData + 'T00:00:00');
    const diaIndex = dataObj.getDay();
    const idSugerido = diaIndex === 0 ? 7 : diaIndex;
    setFormData(prev => ({ ...prev, dtApartamentoVigente: novaData, idDiaSemana: idSugerido }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (apartment?.idApartamentoVistoria) {
        await apartamentoVistoriaService.editar(formData);
      } else {
        await apartamentoVistoriaService.criar(formData);
      }
      onSave(formData);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
      {/* COLUNA ESQUERDA: Formulário com flex-1 para dividir o espaço 50/50 no celular */}
      <div className="flex-1 w-full md:w-1/3 p-6 md:p-10 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col overflow-y-auto">
        <header className="mb-6 md:mb-10">
          <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
            {apartment ? "Editar Registro" : "Novo Agendamento"}
          </h3>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 md:space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Apartamento</label>
            <input
              value={formData.nmApartamentoVistoria}
              onChange={(e) => setFormData({ ...formData, nmApartamentoVistoria: e.target.value })}
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Data</label>
              <input
                type="date"
                value={formData.dtApartamentoVigente}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Dia da Semana</label>
              <select
                value={formData.idDiaSemana}
                onChange={(e) => setFormData({ ...formData, idDiaSemana: Number(e.target.value) })}
                className="w-full border border-slate-200 p-3 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
              >
                <option value={0}>Selecione...</option>
                {diasSemana?.map((d) => <option key={d.idDiaSemana} value={d.idDiaSemana}>{d.nmDiaSemana}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
              <select
                value={formData.idStatusVistoria}
                onChange={(e) => setFormData({ ...formData, idStatusVistoria: Number(e.target.value) })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
              >
                <option value={0}>Selecione...</option>
                {statusList?.map((s) => <option key={s.idStatusVistoria} value={s.idStatusVistoria}>{s.nmStatusVistoria}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Horário</label>
              <input
                type="time"
                value={formData.nmHorarioVistoria}
                onChange={(e) => setFormData({ ...formData, nmHorarioVistoria: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
              />
            </div>
          </div>
        </form>

        {/* Botões ancorados na base */}
        <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 font-bold text-slate-500 rounded-xl p-3 hover:bg-slate-50 text-sm">Cancelar</button>
          <button type="submit" onClick={handleSubmit} className="flex-1 bg-blue-600 text-white font-bold rounded-xl p-3 shadow-lg hover:bg-blue-700 text-sm">Confirmar</button>
        </div>
      </div>

      {/* COLUNA DIREITA: Observações com flex-1 e min-h-0 para respeitar o limite */}
      <div className="flex-1 w-full md:w-2/3 flex flex-col p-6 md:p-10 bg-slate-50 min-h-0">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 ml-1">Observações da Revistoria</label>
        <textarea
          value={formData.txObservacaoRevistoria || ""}
          onChange={(e) => setFormData({ ...formData, txObservacaoRevistoria: e.target.value })}
          className="flex-1 w-full p-4 md:p-6 text-sm text-slate-700 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-sm leading-relaxed"
          placeholder="Digite as observações aqui..."
        />
      </div>
    </div>
  );
}
