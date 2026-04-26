# Padrão de Exibição de Produtos

## Regra Geral
Produtos são exibidos com nome concatenado às dimensões no formato:

```
[NOME] X [LARGURA] X [ESPESSURA] X [COMPRIMENTO]
```

## Exceções
Para unidades **M2** e **M**, o comprimento é omitido:

```
[NOME] X [LARGURA] X [ESPESSURA]
```

## Exemplos
| Produto | Largura | Espessura | Comprimento | Unidade | Resultado |
|---------|---------|-----------|-------------|---------|-----------|
| CAIBRO MAÇ | 5.00 | 2.50 | 4.00 | UNIDADE | `CAIBRO MAÇ X 5.00 X 2.50 X 4.00` |
| CHAPA COMPENSADA | 2.20 | 1.50 | 3.00 | M2 | `CHAPA COMPENSADA X 2.20 X 1.50` |
| PERFIL METÁLICO | 0.10 | - | 6.00 | M | `PERFIL METÁLICO X 0.10 X 6.00` |

## Implementação no Frontend

### Tipo Produto
```typescript
// types/entities.ts
export interface Produto {
    id: string;
    nome: string;
    nome_formatado?: string; // Campo com regra aplicada
    largura?: number;
    espessura?: number;
    comprimento?: number;
    unidade: string;
    // ... outros campos
}
```

### Uso nos Componentes
```typescript
// Sempre usar nome_formatado quando disponível
{produto.nome_formatado || produto.nome}
```

### Aplicação
- **ProdutosPage.tsx** - Lista de produtos
- **PedidoFormPage.tsx** - Combobox de seleção
- **Toast de erros** - Mensagens de estoque
- Demais componentes que exibem produtos

## Backend
O campo `nome_formatado` é fornecido pelo backend através do accessor no modelo `Produto`.

## Validação
- 2 casas decimais
- Separador decimal: ponto
- Valores nulos são omitidos
- Nome sempre exibido
