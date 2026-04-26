import { useState } from "react";
import { X, Save } from "lucide-react";
import { Button, Input } from "../ui";
import type { AreaBloqueada } from "../../services/PatioService";

interface AreaBloqueadaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (area: AreaBloqueada) => void;
  area: AreaBloqueada | null;
}

function AreaBloqueadaFormModalContent({
  onClose,
  onSave,
  area,
}: Omit<AreaBloqueadaFormModalProps, "isOpen">) {
  const [formData, setFormData] = useState({
    nome: area?.nome || "",
    largura: String(area?.largura ?? 5),
    altura: String(area?.altura ?? 5),
    cor: area?.cor || "#CCCCCC",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const parseDecimal = (value: string) => {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const larguraNum = parseDecimal(formData.largura);
    const alturaNum = parseDecimal(formData.altura);

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    if (!Number.isFinite(larguraNum) || larguraNum < 1 || larguraNum > 100) {
      newErrors.largura = "Largura deve estar entre 1 e 100 metros";
    }

    if (!Number.isFinite(alturaNum) || alturaNum < 1 || alturaNum > 100) {
      newErrors.altura = "Altura deve estar entre 1 e 100 metros";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!area) return;
    const larguraNum = parseDecimal(formData.largura);
    const alturaNum = parseDecimal(formData.altura);

    const updatedArea: AreaBloqueada = {
      ...area,
      nome: formData.nome.trim(),
      largura: larguraNum,
      altura: alturaNum,
      cor: formData.cor,
    };

    onSave(updatedArea);
    onClose();
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
      <div className="my-auto w-full max-w-md max-h-[92vh] overflow-hidden bg-white rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-xl font-semibold text-apple-dark">
            {area ? "Editar Área Bloqueada" : "Nova Área Bloqueada"}
          </h2>
          <button
            onClick={handleClose}
            className="text-apple-secondary hover:text-apple-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-84px)] overflow-y-auto p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-apple-dark mb-1">
              Nome da Área *
            </label>
            <Input
              type="text"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              placeholder="Ex: Corredor Principal, Área de Serviço"
              className={errors.nome ? "border-apple-danger" : ""}
            />
            {errors.nome && (
              <p className="text-apple-danger text-xs mt-1">{errors.nome}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-apple-dark mb-1">
                Largura (metros) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.largura}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.,]/g, "");
                  handleChange("largura", value);
                }}
                placeholder="0,00"
                className={`w-full h-10 px-3 border rounded-lg text-sm bg-white ${
                  errors.largura ? "border-apple-danger" : "border-[#d7e5d8]"
                }`}
              />
              {errors.largura && (
                <p className="text-apple-danger text-xs mt-1">{errors.largura}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-apple-dark mb-1">
                Altura (metros) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.altura}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.,]/g, "");
                  handleChange("altura", value);
                }}
                placeholder="0,00"
                className={`w-full h-10 px-3 border rounded-lg text-sm bg-white ${
                  errors.altura ? "border-apple-danger" : "border-[#d7e5d8]"
                }`}
              />
              {errors.altura && (
                <p className="text-apple-danger text-xs mt-1">{errors.altura}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-apple-dark mb-1">
              Cor da Área
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={formData.cor}
                onChange={(e) => handleChange("cor", e.target.value)}
                className="h-10 w-20 rounded border border-[#c5d8c7] cursor-pointer"
              />
              <Input
                type="text"
                value={formData.cor}
                onChange={(e) => handleChange("cor", e.target.value)}
                placeholder="#CCCCCC"
                className="flex-1 min-w-[150px]"
              />
            </div>
            <p className="text-apple-secondary text-xs mt-1">
              Cor de fundo da área no mapa
            </p>
          </div>

          <div className="bg-apple-gray p-3 rounded-lg">
            <p className="text-sm text-apple-secondary">
              <strong>Área total:</strong>{" "}
              {Number.isFinite(parseDecimal(formData.largura))
                ? parseDecimal(formData.largura).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })
                : "0"}m ×{" "}
              {Number.isFinite(parseDecimal(formData.altura))
                ? parseDecimal(formData.altura).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })
                : "0"}m ={" "}
              {Number.isFinite(parseDecimal(formData.largura)) &&
              Number.isFinite(parseDecimal(formData.altura))
                ? (parseDecimal(formData.largura) * parseDecimal(formData.altura)).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 1, maximumFractionDigits: 2 },
                  )
                : "0"}
              m²
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2 text-apple-dark bg-[#e3ede3] hover:bg-[#d7e5d8]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary text-white flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AreaBloqueadaFormModal({
  isOpen,
  onClose,
  onSave,
  area,
}: AreaBloqueadaFormModalProps) {
  if (!isOpen) return null;

  return (
    <AreaBloqueadaFormModalContent
      key={area?.id}
      onClose={onClose}
      onSave={onSave}
      area={area}
    />
  );
}
