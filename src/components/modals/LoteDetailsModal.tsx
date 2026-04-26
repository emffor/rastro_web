import { Box, Edit, FileText, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Modal } from "../ui";
import { LoteService, type Lote } from "../../services/PatioService";
import type { DofLote, DofLotesResumo } from "../../types";
import { formatarNumero, formatarVolume } from "../../utils/format";

interface LoteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loteId: string | null;
  onDataChanged?: () => void;
  onEdit?: (lote: Lote) => void;
  onDelete?: (lote: Lote) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "default" }> = {
  DISPONIVEL: { label: "Disponível", variant: "success" },
  OCUPADO: { label: "Ocupado", variant: "danger" },
  RESERVADO: { label: "Reservado", variant: "warning" },
  BLOQUEADO: { label: "Bloqueado", variant: "default" },
};

const RESUMO_VAZIO: DofLotesResumo = {
  total_pecas: 0,
  total_volume_m3: 0,
  itens_dof: [],
  produtos_dimensionados: [],
};

export function LoteDetailsModal({
  isOpen,
  onClose,
  loteId,
  onDataChanged,
  onEdit,
  onDelete,
}: LoteDetailsModalProps) {
  const [lote, setLote] = useState<Lote | null>(null);
  const [alocacoes, setAlocacoes] = useState<DofLote[]>([]);
  const [resumoPecas, setResumoPecas] = useState<DofLotesResumo>(RESUMO_VAZIO);
  const [isLoading, setIsLoading] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!loteId) return;

    setIsLoading(true);
    try {
      const [loteData, alocacoesData] = await Promise.all([
        LoteService.buscar(loteId),
        LoteService.listarAlocacoes(loteId),
      ]);
      setLote(loteData);
      setAlocacoes(alocacoesData.dados || []);
      setResumoPecas(alocacoesData.resumo || RESUMO_VAZIO);
    } catch {
      setLote(null);
      setAlocacoes([]);
      setResumoPecas(RESUMO_VAZIO);
    } finally {
      setIsLoading(false);
    }
  }, [loteId]);

  useEffect(() => {
    if (isOpen && loteId) {
      carregarDados();
    } else {
      setLote(null);
      setAlocacoes([]);
      setResumoPecas(RESUMO_VAZIO);
    }
  }, [isOpen, loteId, carregarDados]);

  const statusInfo = lote ? STATUS_LABELS[lote.status] : null;
  const volumeTotal = alocacoes.reduce((acc, al) => acc + Number(al.volume_m3), 0);
  const mostrarTotalPecas =
    resumoPecas.total_pecas > 0 &&
    alocacoes.some((al) => al.modo_alocacao !== "MANUAL");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lote ? `Lote ${lote.nome}` : "Detalhes do Lote"}
      icon={<Box className="h-5 w-5" />}
      size="2xl"
    >
      {isLoading ? (
        <div className="text-center py-8 text-apple-secondary">Carregando...</div>
      ) : lote ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-apple-gray rounded-xl p-4">
              <p className="text-xs text-apple-secondary mb-1">Status</p>
              {statusInfo && (
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              )}
            </div>
            <div className="bg-apple-gray rounded-xl p-4">
              <p className="text-xs text-apple-secondary mb-1">Volume Ocupado</p>
              <p className="text-lg font-bold text-apple-dark">
                {formatarNumero(lote.volume_ocupado, 4)} m³
                {lote.capacidade_volume && (
                  <span className="text-sm font-normal text-apple-secondary ml-1">
                    / {formatarNumero(lote.capacidade_volume, 4)} m³
                  </span>
                )}
              </p>
              {lote.capacidade_volume && (
                <div className="mt-3">
                  <div className="w-full bg-primary-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(1, Math.min(100, lote.percentual_ocupacao || 0))}%`,
                        backgroundColor:
                          (lote.percentual_ocupacao || 0) > 80
                            ? "#F44336"
                            : (lote.percentual_ocupacao || 0) > 50
                            ? "#FF9800"
                            : "#4CAF50",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-apple-gray rounded-xl p-4">
              <p className="text-xs text-apple-secondary mb-1">DOFs Alocados</p>
              <p className="text-lg font-bold text-apple-dark">{alocacoes.length}</p>
            </div>
            {mostrarTotalPecas && (
              <div className="bg-apple-gray rounded-xl p-4">
                <p className="text-xs text-apple-secondary mb-1">Total de Peças</p>
                <p className="text-lg font-bold text-apple-dark font-mono">{resumoPecas.total_pecas}</p>
              </div>
            )}
          </div>

          {lote.descricao && (
            <div className="bg-primary-muted rounded-xl p-4">
              <p className="text-sm text-primary-dark">{lote.descricao}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-apple-dark mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Alocações DOF ({formatarVolume(volumeTotal)})
            </h3>

            {alocacoes.length === 0 ? (
              <div className="text-center py-12 bg-apple-gray rounded-xl">
                <Box className="h-12 w-12 mx-auto mb-3 opacity-50 text-apple-secondary" />
                <p className="text-apple-secondary font-medium">Este lote está vazio</p>
                <p className="text-sm text-apple-secondary mt-1">Nenhum DOF alocado neste lote</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border rounded-xl overflow-hidden">
                {alocacoes.map((al) => (
                  <div key={al.id} className="px-4 py-3 flex items-center justify-between hover:bg-apple-gray">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-apple-dark">
                        DOF #{al.dof?.numero || "—"}
                      </p>
                      {al.observacao && (
                        <p className="text-xs text-apple-secondary mt-0.5">{al.observacao}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-apple-dark font-mono">
                      {formatarVolume(al.volume_m3)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between gap-3 pt-6 border-t">
            <div className="flex gap-3">
              {onDelete && lote && (
                <Button
                  variant="danger"
                  onClick={() => { onDelete(lote); onDataChanged?.(); }}
                  disabled={alocacoes.length > 0}
                  title={alocacoes.length > 0 ? "Não é possível excluir lote com DOFs alocados" : "Excluir lote"}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              )}
              {onEdit && lote && (
                <Button variant="secondary" onClick={() => onEdit(lote)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-apple-secondary">Lote não encontrado</div>
      )}
    </Modal>
  );
}
