export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ATIVO: { label: "Não alocado", cls: "bg-apple-danger/10 text-apple-danger border-apple-danger/20" },
  PARCIAL: {
    label: "Parcial",
    cls: "bg-apple-warning/10 text-apple-warning border-apple-warning/20",
  },
  ENCERRADO: {
    label: "Alocado",
    cls: "bg-primary-muted text-primary-dark border-primary/20",
  },
};
