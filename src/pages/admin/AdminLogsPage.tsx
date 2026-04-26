import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Badge, Card, Input, Table } from "../../components/ui";
import { api } from "../../services";
import { formatDate } from "../../utils/date";

interface ActivityLog {
  id: number;
  log_name: string | null;
  description: string;
  event: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  properties?: Record<string, unknown>;
  causer?: {
    name?: string;
    email?: string;
  } | null;
  usuario_efetivo?: {
    name?: string;
    email?: string;
  } | null;
  created_at: string;
}

const moduleLabels: Record<string, string> = {
  anexos: "Anexos",
  autenticacao: "Autenticação",
  erros_execucao: "Erros de execução",
  movimentacoes: "Movimentações",
  requisicoes_empresa: "Requisições da empresa",
  sessao_empresa: "Sessão da empresa",
  default: "Alteração de cadastro",
};

const eventLabels: Record<string, string> = {
  anexo_enviado: "Anexo enviado",
  anexo_substituido: "Anexo substituído",
  anexo_removido: "Anexo removido",
  anexo_removido_para_substituicao: "Anexo removido para substituição",
  created: "Criado",
  updated: "Editado",
  deleted: "Excluído",
  login_realizado: "Login realizado",
  logout_realizado: "Logout realizado",
  login_falhou: "Tentativa inválida de autenticação",
  erro_execucao: "Erro de execução",
  requisicao_sucesso: "Ação realizada",
  requisicao_erro: "Erro na requisição",
  controle_empresa_iniciado: "Controle iniciado",
  controle_empresa_encerrado: "Controle encerrado",
  movimentacao_registrada: "Movimentação registrada",
};

const failureReasonLabels: Record<string, string> = {
  credenciais_invalidas: "Credenciais inválidas",
  usuario_inativo: "Usuário inativo",
  empresa_inativa: "Empresa inativa",
};

const actionLabels: Record<string, string> = {
  criar: "Criou",
  editar: "Editou",
  deletar: "Excluiu",
  executar: "Executou",
};

const fieldLabels: Record<string, string> = {
  ativo: "status ativo",
  cargo_id: "cargo",
  email: "e-mail",
  is_admin: "administrador",
  name: "nome",
  nome: "nome",
  descricao: "descrição",
  status: "status",
  volume_total: "volume total",
  volume_saldo_m3: "saldo",
};

const routeModuleLabels: Array<[string, string]> = [
  ["empresa/config", "Configuração da empresa"],
  ["produtos-dimensionados", "Produtos dimensionados"],
  ["areas-bloqueadas", "Áreas bloqueadas"],
  ["dof-lotes", "Alocações DOF"],
  ["movimentacoes", "Movimentações"],
  ["usuarios", "Usuários"],
  ["cargos", "Cargos"],
  ["especies", "Espécies"],
  ["patios", "Pátios"],
  ["lotes", "Lotes"],
  ["dofs", "DOFs"],
  ["anexos", "Anexos"],
  ["dashboard", "Dashboard"],
];

const subjectTypeLabels: Record<string, string> = {
  "App\\Models\\Anexo": "Anexo",
  "App\\Models\\Cargo": "Cargo",
  "App\\Models\\Dof": "DOF",
  "App\\Models\\DofAlocacao": "Alocação DOF",
  "App\\Models\\DofLote": "Alocação DOF",
  "App\\Models\\Empresa": "Empresa",
  "App\\Models\\Especie": "Espécie",
  "App\\Models\\Lote": "Lote",
  "App\\Models\\Movimentacao": "Movimentação",
  "App\\Models\\Patio": "Pátio",
  "App\\Models\\ProdutoDimensionado": "Produto dimensionado",
  "App\\Models\\SaidaOperacao": "Saída",
  "App\\Models\\User": "Usuário",
};

function formatLogModule(log: ActivityLog) {
  const logName = log.log_name;

  if (logName === "requisicoes_empresa") {
    return inferModuleFromPath(getStringProperty(log, "path")) || moduleLabels[logName];
  }

  if (!logName) {
    return "-";
  }

  return moduleLabels[logName] || logName;
}

function formatLogEvent(log: ActivityLog) {
  if (log.event && eventLabels[log.event]) {
    return eventLabels[log.event];
  }

  return log.event || log.description;
}

function getStringProperty(log: ActivityLog, key: string) {
  const value = log.properties?.[key];

  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getNumberProperty(log: ActivityLog, key: string) {
  const value = log.properties?.[key];

  return typeof value === "number" ? value : null;
}

function getRecordProperty(log: ActivityLog, key: string) {
  const value = log.properties?.[key];

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePath(path: string | null) {
  if (!path) {
    return null;
  }

  return path.replace(/^\/?api\//, "").replace(/^\/+/, "");
}

function inferModuleFromPath(path: string | null) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return null;
  }

  return routeModuleLabels.find(([prefix]) => normalizedPath.startsWith(prefix))?.[1] || null;
}

function abreviarValorLongo(valor: string, tamanhoInicio = 10) {
  return valor.length > tamanhoInicio + 3 ? `${valor.slice(0, tamanhoInicio)}...` : valor;
}

function formatRoute(path: string | null, abreviarIds = true) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return null;
  }

  if (!abreviarIds) {
    return `/${normalizedPath}`;
  }

  return `/${normalizedPath.replace(/\/[^/]{20,}(?=\/|$)/g, (segmento) =>
    abreviarValorLongo(segmento, 10),
  )}`;
}

function formatAction(log: ActivityLog) {
  const action = getStringProperty(log, "acao");

  return action ? actionLabels[action] || action : null;
}

function formatSubject(log: ActivityLog) {
  if (!log.subject_type) {
    return null;
  }

  return subjectTypeLabels[log.subject_type] || log.subject_type.split("\\").pop() || null;
}

function formatCategoria(categoria: string | null) {
  if (!categoria) {
    return null;
  }

  return categoria
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatChangedFields(log: ActivityLog) {
  const attributes = getRecordProperty(log, "attributes");
  const old = getRecordProperty(log, "old");
  const fields = Object.keys(attributes || old || {});

  if (fields.length === 0) {
    return null;
  }

  return `Campos: ${fields
    .slice(0, 4)
    .map((field) => fieldLabels[field] || field)
    .join(", ")}${fields.length > 4 ? "..." : ""}`;
}

function formatLogDetails(log: ActivityLog, abreviar = true) {
  const email = getStringProperty(log, "email");
  const ip = getStringProperty(log, "ip");
  const motivo = getStringProperty(log, "motivo");
  const metodo = getStringProperty(log, "metodo");
  const path = getStringProperty(log, "path");
  const rota = formatRoute(path, abreviar);
  const acao = formatAction(log);
  const subject = formatSubject(log);

  if (log.log_name === "anexos") {
    const arquivo = getStringProperty(log, "arquivo");
    const categoria = formatCategoria(getStringProperty(log, "categoria"));
    const entidade = getStringProperty(log, "entidade_tipo")?.split("\\").pop();

    return [
      arquivo ? `Arquivo: ${arquivo}` : subject,
      categoria ? `Categoria: ${categoria}` : null,
      entidade ? `Vinculado a ${subjectTypeLabels[`App\\Models\\${entidade}`] || entidade}` : null,
      ip ? `IP ${ip}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || "-";
  }

  if (log.log_name === "requisicoes_empresa") {
    return [
      acao ? `${acao} em ${inferModuleFromPath(path) || "módulo operacional"}` : null,
      metodo && rota ? `${metodo} ${rota}` : rota,
      ip ? `IP ${ip}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || "-";
  }

  if (log.log_name === "sessao_empresa") {
    return [
      getStringProperty(log, "empresa_id") ? "Empresa selecionada" : null,
      ip ? `IP ${ip}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || "-";
  }

  if (log.event === "erro_execucao") {
    return [metodo && rota ? `${metodo} ${rota}` : rota, ip ? `IP ${ip}` : null]
      .filter(Boolean)
      .join(" | ") || "-";
  }

  return [
    subject && log.subject_id
      ? `${subject} ${abreviar ? abreviarValorLongo(String(log.subject_id), 10) : log.subject_id}`
      : subject,
    email,
    motivo ? failureReasonLabels[motivo] || motivo : null,
    ip ? `IP ${ip}` : null,
    formatChangedFields(log),
  ]
    .filter(Boolean)
    .join(" | ") || "-";
}

function formatStatus(log: ActivityLog) {
  const statusCode = getNumberProperty(log, "status_code");

  if (statusCode) {
    const variant = statusCode >= 500 ? "danger" : statusCode >= 400 ? "warning" : "success";

    return <Badge variant={variant}>{statusCode}</Badge>;
  }

  if (log.event === "login_falhou" || log.event === "requisicao_erro" || log.event === "erro_execucao") {
    return <Badge variant="warning">Falha</Badge>;
  }

  return <Badge variant="success">OK</Badge>;
}

function formatControl(log: ActivityLog) {
  return log.properties?.executado_por_admin_master ? "Master controlando" : "Direto";
}

function renderMobileLog(log: ActivityLog) {
  return (
    <div className="rounded-md border border-primary-muted bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-apple-dark">{formatLogEvent(log)}</p>
          <p className="text-xs text-apple-secondary">{formatDate(log.created_at)}</p>
        </div>
        {formatStatus(log)}
      </div>
      <p className="mt-2 text-apple-secondary">{formatLogModule(log)}</p>
      <p className="mt-1 text-apple-dark" title={formatLogDetails(log, false)}>
        {formatLogDetails(log)}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-apple-secondary">
        <span>Executor: {log.causer?.name || log.causer?.email || "-"}</span>
        <span>Controle: {formatControl(log)}</span>
      </div>
    </div>
  );
}

export function AdminLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<{ dados: ActivityLog[] }>("/admin/logs", {
        params: { busca: search || undefined, per_page: 50 },
      });
      setLogs(data.dados || []);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLogs();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadLogs]);

  const columns = [
    {
      key: "created_at",
      header: "Data",
      render: (log: ActivityLog) => formatDate(log.created_at),
    },
    {
      key: "description",
      header: "Evento",
      render: (log: ActivityLog) => formatLogEvent(log),
      className: "w-[170px] min-w-[170px]",
    },
    {
      key: "log_name",
      header: "Módulo",
      render: (log: ActivityLog) => formatLogModule(log),
      className: "w-[190px] min-w-[190px]",
    },
    {
      key: "detalhes",
      header: "Detalhes",
      render: (log: ActivityLog) => (
        <span
          className="block max-w-[520px] whitespace-normal break-words leading-relaxed"
          title={formatLogDetails(log, false)}
        >
          {formatLogDetails(log)}
        </span>
      ),
      className: "w-[520px] min-w-[420px] max-w-[520px] whitespace-normal",
    },
    {
      key: "status",
      header: "Status",
      render: (log: ActivityLog) => formatStatus(log),
      className: "w-[74px] min-w-[74px]",
    },
    {
      key: "causer",
      header: "Executor real",
      render: (log: ActivityLog) => log.causer?.name || log.causer?.email || "-",
      className: "w-[130px] min-w-[130px]",
    },
    {
      key: "usuario_efetivo",
      header: "Usuário da ação",
      render: (log: ActivityLog) =>
        log.usuario_efetivo?.name ||
        log.usuario_efetivo?.email ||
        log.causer?.name ||
        log.causer?.email ||
        "-",
      className: "w-[130px] min-w-[130px]",
    },
    {
      key: "properties",
      header: "Controle",
      render: (log: ActivityLog) => formatControl(log),
      className: "w-[150px] min-w-[150px]",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Logs"
        description="Auditoria de ações globais e controle de empresas"
      />
      <AnimatedSection>
        <Card>
          <div className="border-b border-primary-muted p-4">
            <Input
              placeholder="Buscar por evento ou módulo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          <Table
            data={logs}
            columns={columns}
            keyExtractor={(log) => log.id}
            isLoading={isLoading}
            emptyMessage="Nenhum log encontrado"
            mobileCardRender={renderMobileLog}
          />
        </Card>
      </AnimatedSection>
    </div>
  );
}
