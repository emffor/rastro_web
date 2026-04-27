export type UnidadeMedida = 'm³' | 'st';

export const UNIDADES_MEDIDA: { value: UnidadeMedida; label: string }[] = [
  { value: 'm³', label: 'Metro cúbico (m³)' },
  { value: 'st', label: 'Estéreo (st)' },
];

export function obterUnidadeDof(dof?: { unidade_medida?: string } | null): string {
  return dof?.unidade_medida || 'm³';
}

export function labelVolume(unidade: string): string {
  return `Volume (${unidade})`;
}

export function labelQtd(unidade: string): string {
  return `Qtd (${unidade})`;
}
