/**
 * Funções de formatação numérica no padrão brasileiro (pt-BR).
 *
 * - Separador decimal: vírgula (,)
 * - Separador de milhar: ponto (.)
 *
 * Exemplos:
 *   formatarNumero(1016.8, 4)  → "1.016,8000"
 *   formatarVolume(24.8)       → "24,8000 m³"
 *   formatarArea(6400)         → "6.400,0 m²"
 *   formatarPercentual(85.7)   → "85,7%"
 */

const LOCALE = "pt-BR";

/**
 * Formata um número no padrão brasileiro com quantidade fixa de casas decimais.
 */
export function formatarNumero(valor: number | string | null | undefined, decimais: number = 2): string {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "0";

  return numero.toLocaleString(LOCALE, {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

/**
 * Formata volume em m³ no padrão brasileiro. Padrão: 4 casas decimais.
 */
export function formatarVolume(valor: number | string | null | undefined, decimais: number = 4): string {
  return `${formatarNumero(valor, decimais)} m³`;
}

/**
 * Formata área em m² no padrão brasileiro. Padrão: 1 casa decimal.
 */
export function formatarArea(valor: number | string | null | undefined, decimais: number = 1): string {
  return `${formatarNumero(valor, decimais)} m²`;
}

/**
 * Formata percentual no padrão brasileiro. Padrão: 1 casa decimal.
 */
export function formatarPercentual(valor: number | string | null | undefined, decimais: number = 1): string {
  return `${formatarNumero(valor, decimais)}%`;
}

/**
 * Formata dimensões (largura × comprimento) em metros no padrão brasileiro.
 */
export function formatarDimensoes(
  largura: number | string | null | undefined,
  comprimento: number | string | null | undefined,
  decimais: number = 2,
): string {
  return `${formatarNumero(largura, decimais)} x ${formatarNumero(comprimento, decimais)} m`;
}

/**
 * Formata CNPJ no padrão XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  if (cnpjLimpo.length !== 14) return cnpj;
  return cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formata CNPJ durante a digitação (máscara)
 */
export function mascararCNPJ(valor: string): string {
  const cnpjLimpo = valor.replace(/\D/g, "");
  if (cnpjLimpo.length <= 2) return cnpjLimpo;
  if (cnpjLimpo.length <= 5) return cnpjLimpo.replace(/^(\d{2})(\d{0,3})$/, "$1.$2");
  if (cnpjLimpo.length <= 8) return cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{0,3})$/, "$1.$2.$3");
  if (cnpjLimpo.length <= 12) return cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, "$1.$2.$3/$4");
  return cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, "$1.$2.$3/$4-$5");
}
