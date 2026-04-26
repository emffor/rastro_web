export function resolverTipoSerragemEspecie(
  especie?: {
    tipo?: string | null;
    nome_tipo?: string | null;
    tipo_serragem?: { nome?: string | null } | null;
  } | null,
): string {
  return (
    especie?.tipo_serragem?.nome ||
    especie?.tipo ||
    especie?.nome_tipo ||
    ""
  ).trim();
}
