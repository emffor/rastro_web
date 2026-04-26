export const TIPO_CONFIG: Record<
  string,
  { variant: "success" | "danger" | "warning" | "info"; label: string }
> = {
  ENTRADA: { variant: "success", label: "Entrada" },
  TRANSFERENCIA: { variant: "info", label: "Transferência" },
  BAIXA: { variant: "danger", label: "Baixa" },
  AJUSTE: { variant: "warning", label: "Ajuste" },
};

export const TIPO_BADGE_CLASS: Record<string, string> = {
  ENTRADA: "text-primary-dark bg-primary-muted",
  TRANSFERENCIA: "text-primary-dark bg-primary-muted",
  BAIXA: "text-apple-danger bg-apple-danger/10",
  AJUSTE: "text-apple-warning bg-apple-warning/10",
};

export const TIPOS_MOVIMENTACAO = [
  "ENTRADA",
  "TRANSFERENCIA",
  "BAIXA",
  "AJUSTE",
] as const;
