import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Badge, Button, Card, Input, Table } from "../components/ui";
import { useConfirmDialog, useDebounce, usePermissions } from "../hooks";
import { DofApiService } from "../services/PatioService";
import { formatDateOnly } from "../utils/date";
import { formatarNumero, formatarVolume } from "../utils/format";
import { toastUtils } from "../utils/toast";
import { STATUS_MAP } from "../constants/dof";
import type { Dof } from "../types";

const extrairMensagemApi = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const mensagem = (error as { response?: { data?: { mensagem?: unknown } } })
    .response?.data?.mensagem;
  return typeof mensagem === "string" && mensagem.trim() !== ""
    ? mensagem
    : undefined;
};

export function DofsPage() {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();
  const { can } = usePermissions();
  const [dofs, setDofs] = useState<Dof[]>([]);
  const [resumoGerencial, setResumoGerencial] = useState({
    total_dofs: 0,
    dofs_ativos: 0,
    dofs_parciais: 0,
    dofs_encerrados: 0,
    volume_total_m3: 0,
    volume_saldo_m3: 0,
    volume_alocado_m3: 0,
    percentual_alocado: 0,
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const podeCriar = can("dofs.criar");
  const podeEditar = can("dofs.editar");
  const podeExcluir = can("dofs.excluir");

  const loadDofs = useCallback(async (page: number, termo: string) => {
    const thisRequestId = ++requestIdRef.current;
    try {
      if (!hasLoadedRef.current) {
        setIsInitialLoading(true);
      }
      setIsFetching(true);
      const filtrosTabela: Record<string, string> = {
        page: String(page),
        per_page: String(perPage),
      };

      const filtrosResumo: Record<string, string> = {};

      if (termo.trim()) {
        filtrosTabela.numero = termo.trim();
        filtrosResumo.numero = termo.trim();
      }

      const [resultTabela, resultResumo] = await Promise.all([
        DofApiService.listar(filtrosTabela),
        DofApiService.resumo(filtrosResumo),
      ]);

      if (thisRequestId !== requestIdRef.current) return;

      setDofs(resultTabela.dados || []);
      setCurrentPage(resultTabela.paginacao.pagina);
      setTotal(resultTabela.paginacao.total);
      setLastPage(
        Math.ceil(
          resultTabela.paginacao.total /
            resultTabela.paginacao.itens_por_pagina,
        ) || 1,
      );

      setResumoGerencial({
        total_dofs: Number(resultResumo.total_dofs || 0),
        dofs_ativos: Number(resultResumo.dofs_ativos || 0),
        dofs_parciais: Number(resultResumo.dofs_parciais || 0),
        dofs_encerrados: Number(resultResumo.dofs_encerrados || 0),
        volume_total_m3: Number(resultResumo.volume_total_m3 || 0),
        volume_saldo_m3: Number(resultResumo.volume_saldo_m3 || 0),
        volume_alocado_m3: Number(resultResumo.volume_alocado_m3 || 0),
        percentual_alocado: Number(resultResumo.percentual_alocado || 0),
      });
    } catch {
      if (thisRequestId !== requestIdRef.current) return;
      setDofs([]);
      setTotal(0);
      setLastPage(1);
    } finally {
      if (thisRequestId === requestIdRef.current) {
        hasLoadedRef.current = true;
        setIsInitialLoading(false);
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDofs(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, loadDofs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const inicioPagina = total > 0 ? (currentPage - 1) * perPage + 1 : 0;
  const fimPagina = Math.min(currentPage * perPage, Math.max(0, total));

  const handleExportarRelatorioPdf = async () => {
    if (!total) {
      toastUtils.warning("Nenhum DOF para exportar no filtro atual.");
      return;
    }

    try {
      const filtros: Record<string, string> = {};
      if (debouncedSearch.trim()) {
        filtros.numero = debouncedSearch.trim();
      }

      const { blob, fileName } = await DofApiService.relatorioPdf(filtros);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        fileName ||
        `relatorio-dofs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao gerar relatório PDF.");
    }
  };

  const handleExportarRelatorioExcel = async () => {
    if (!total) {
      toastUtils.warning("Nenhum DOF para exportar no filtro atual.");
      return;
    }

    try {
      const filtros: Record<string, string> = {};
      if (debouncedSearch.trim()) {
        filtros.numero = debouncedSearch.trim();
      }

      const { blob, fileName } = await DofApiService.relatorioExcel(filtros);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        fileName ||
        `relatorio-dofs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao gerar relatório Excel.");
    }
  };

  const handleDelete = useCallback(
    async (dof: Dof) => {
      const confirmed = await dialog.confirm({
        title: "Excluir DOF",
        message: `Excluir DOF "${dof.numero}"?`,
        confirmText: "Excluir",
        variant: "danger",
      });
      if (!confirmed) return;
      try {
        await DofApiService.excluir(dof.id);
        loadDofs(currentPage, debouncedSearch);
      } catch (error: unknown) {
        const mensagemApi = extrairMensagemApi(error);
        toastUtils.error(mensagemApi || "Erro ao excluir DOF.");
      }
    },
    [currentPage, debouncedSearch, dialog, loadDofs],
  );

  const columns = useMemo(
    () => [
      {
        key: "numero",
        header: "Número",
        render: (d: Dof) => (
          <span className="font-medium text-apple-dark">{d.numero}</span>
        ),
      },
      {
        key: "origem",
        header: "Origem / Destino",
        render: (d: Dof) => (
          <div className="text-xs">
            <span className="text-apple-secondary">{d.origem || "—"}</span>
            <span className="text-apple-secondary mx-1">→</span>
            <span className="text-apple-secondary">{d.destino || "—"}</span>
          </div>
        ),
      },
      {
        key: "data_emissao",
        header: "Data Emissão",
        render: (d: Dof) => <span>{formatDateOnly(d.data_emissao)}</span>,
      },
      {
        key: "valido_ate",
        header: "Data Validade",
        render: (d: Dof) => <span>{formatDateOnly(d.valido_ate)}</span>,
      },
      {
        key: "volume",
        header: "Volume (m³)",
        render: (d: Dof) => {
          const _total = Number(d.volume_total);
          const saldo = Number(d.volume_saldo_m3);
          const alocado = Math.max(0, _total - saldo);
          const pct = _total > 0 ? (alocado / _total) * 100 : 0;

          return (
            <div className="flex w-40 items-center gap-2">
              <div className="flex-1">
                <div className="h-1 w-full rounded-full bg-primary-muted">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? "bg-primary" : pct > 0 ? "bg-primary" : "bg-red-400"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs text-apple-secondary">
                {formatarNumero(alocado, 4)}
                <span className="text-primary-muted">/</span>
                {formatarNumero(_total, 4)}
              </span>
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (d: Dof) => {
          const info = STATUS_MAP[d.status] || {
            label: d.status,
            cls: "bg-primary-muted text-apple-secondary border-primary-muted",
          };
          return (
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide ${info.cls}`}
            >
              {info.label}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "",
        className: "w-36",
        render: (d: Dof) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => navigate(`/dofs/${d.id}/alocacao`)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                Number(d.volume_saldo_m3) > 0
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "border border-primary-muted text-apple-secondary hover:bg-apple-gray"
              }`}
              title="Abrir tela de alocação"
            >
              {Number(d.volume_saldo_m3) > 0 ? "Alocar" : "Gerenciar"}
            </button>
            <button
              onClick={() => navigate(`/dofs/${d.id}`)}
              disabled={!podeEditar}
              className="rounded p-1 text-apple-secondary hover:bg-primary-muted hover:text-apple-secondary disabled:cursor-not-allowed disabled:opacity-40"
              title={podeEditar ? "Editar" : "Sem permissão para editar"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(d)}
              disabled={!podeExcluir}
              className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
              title={podeExcluir ? "Excluir" : "Sem permissão para excluir"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [handleDelete, navigate, podeEditar, podeExcluir],
  );

  return (
    <div>
      <PageHeader
        title="DOFs"
        description="Documentos de Origem Florestal — Controle de volume e alocação"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleExportarRelatorioPdf}
              disabled={!total}
              title="Baixar relatório PDF"
            >
              <FileDown className="h-4 w-4" /> Relatório PDF
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportarRelatorioExcel}
              disabled={!total}
              title="Baixar relatório Excel"
            >
              <FileSpreadsheet className="h-4 w-4" /> Relatório Excel
            </Button>
            <Button
              onClick={() => navigate("/dofs/novo")}
              disabled={!podeCriar}
              title={podeCriar ? "Novo DOF" : "Sem permissão para criar"}
            >
              <Plus className="h-4 w-4" /> Novo DOF
            </Button>
          </div>
        }
      />
      <AnimatedSection>
        <div className="mb-6 flex flex-wrap items-center gap-6 rounded-xl border border-primary-muted bg-white px-5 py-4">
          <div className="flex w-full sm:w-auto sm:min-w-40 flex-col gap-0.5">
            <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
              Total de DOFs
            </p>
            <p className="text-xl font-semibold text-apple-dark">
              {resumoGerencial.total_dofs}
            </p>
          </div>
          <div className="hidden sm:block h-8 w-px bg-primary-muted" />
          <div className="flex w-full sm:w-auto sm:min-w-40 flex-col gap-0.5">
            <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
              Volume Total
            </p>
            <p className="text-xl font-semibold text-apple-dark">
              {formatarVolume(resumoGerencial.volume_total_m3)}
            </p>
          </div>
          <div className="hidden sm:block h-8 w-px bg-primary-muted" />
          <div className="flex w-full sm:w-auto sm:min-w-40 flex-col gap-0.5">
            <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
              Volume Alocado
            </p>
            <p className="text-xl font-semibold text-apple-dark">
              {formatarVolume(resumoGerencial.volume_alocado_m3)}
            </p>
          </div>
          <div className="hidden sm:block h-8 w-px bg-primary-muted" />
          <div className="flex w-full sm:w-auto sm:min-w-40 flex-col gap-0.5">
            <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
              Saldo
            </p>
            <p className="text-xl font-semibold text-primary">
              {formatarVolume(resumoGerencial.volume_saldo_m3)}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant="danger">
              Não alocados: {resumoGerencial.dofs_ativos}
            </Badge>
            <Badge variant="warning">
              Parciais: {resumoGerencial.dofs_parciais}
            </Badge>
            <Badge variant="success">
              Alocados: {resumoGerencial.dofs_encerrados}
            </Badge>
          </div>
        </div>
      </AnimatedSection>
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-primary-muted">
            <Input
              placeholder="Buscar por número do DOF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          {isFetching && !isInitialLoading && (
            <div className="h-0.5 bg-primary/60 animate-pulse" />
          )}
          <Table
            data={dofs}
            columns={columns}
            keyExtractor={(d) => d.id}
            isLoading={isInitialLoading}
            emptyMessage="Nenhum DOF encontrado"
          />
          <div className="border-t border-primary-muted px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-apple-secondary">
                Mostrando {inicioPagina} a {fimPagina} de {total} registros.
              </p>

              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={
                      currentPage === 1 || isInitialLoading || isFetching
                    }
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-apple-secondary">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Página {currentPage} de {lastPage}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(lastPage, p + 1))
                    }
                    disabled={
                      currentPage === lastPage || isInitialLoading || isFetching
                    }
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </AnimatedSection>
    </div>
  );
}
