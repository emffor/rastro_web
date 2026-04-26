## ESCOPO E PRECEDENCIA

- Este arquivo define regras gerais para este projeto frontend.
- Em caso de conflito, siga esta ordem:
  1. instrucao direta do usuario
  2. AGENTS.md mais proximo do arquivo alterado
  3. AGENTS.md de niveis superiores
  4. documentacao interna do repositorio
  5. padroes da ferramenta

## COMPORTAMENTO

- Priorize seguranca, precisao, contexto e previsibilidade acima de velocidade.
- Responda de forma direta, objetiva e em tom natural.
- Comunicacao exclusivamente em pt-BR.
- Antes de implementar, entenda o objetivo, as restricoes tecnicas e o impacto da mudanca.
- Nao assumir mudancas arquiteturais sem necessidade real.
- Em caso de ambiguidade, adote a premissa mais segura e coerente com o contexto; quando houver risco relevante, explicite a premissa adotada.

## WORKFLOW

- Antes de alterar arquivos, apresente um plano curto e objetivo.
- Antes de implementar, valide premissas funcionais e tecnicas.
- Considere edge cases, regressao funcional, regressao visual, impacto no usuario final, acessibilidade, responsividade e compatibilidade.
- Ao concluir, resuma de forma objetiva:
  - o que foi alterado
  - riscos ou impactos
  - o que foi validado
  - o que nao foi validado

## OPERACOES DE RISCO

- Nunca executar automaticamente operacoes destrutivas, irreversiveis ou de alto impacto.
- Sempre pedir confirmacao explicita do usuario antes de qualquer acao com risco relevante.
- Isso inclui, mas nao se limita a:
  - overwrite irreversivel
  - remocao ampla de arquivos
  - refactors estruturais com alto impacto
  - alteracoes de contrato com risco de quebra
  - mudancas que possam comprometer compatibilidade, funcionamento ou integridade do sistema
- Em operacoes de risco, priorize preservacao, compatibilidade e reversibilidade.

## REGRAS GERAIS DE CODIGO

- Proibido usar TODO, FIXME, placeholders ou mocks permanentes sem alinhamento explicito.
- Entregue apenas codigo completo, funcional, coerente com o contexto e executavel dentro da arquitetura do projeto.
- Nunca forneca codigo parcial, meramente ilustrativo ou inconsistente com o padrao existente.
- Prefira responsabilidade unica por modulo, componente, funcao ou hook.
- Prefira nomes claros, descritivos e consistentes com o dominio.
- Evite aninhamento excessivo; use early returns quando fizer sentido.
- Remova imports, variaveis, funcoes e trechos nao utilizados.
- Nao deixar codigo comentado, logs de debug, prints de depuracao, console.log ou equivalentes sem justificativa real.
- Evite duplicacao desnecessaria.
- Nao introduza abstrações prematuras ou desnecessarias.
- Respeite o estilo e os padroes ja existentes no repositorio.

## ARQUITETURA E ORGANIZACAO

- Respeite a arquitetura adotada no projeto.
- Mantenha camadas bem definidas e evite misturar responsabilidades.
- Separe apresentacao, estado, acesso a dados, orquestracao e integracoes quando o contexto exigir.
- Evite componentes, hooks e modulos grandes demais; extraia partes reutilizaveis quando isso melhorar clareza, manutencao e teste.
- Nao crie duas fontes de verdade para o mesmo estado, configuracao ou regra.

## DADOS, CONTRATO E COMPATIBILIDADE

- Preserve compatibilidade retroativa sempre que possivel.
- Quando houver mudanca de contrato, comportamento ou estrutura, documente claramente o impacto.
- Valide entradas antes de enviar ou processar dados quando aplicavel.
- Padronize tratamento de sucesso e erro conforme o padrao do projeto.
- Nao exponha detalhes sensiveis, internos ou desnecessarios em mensagens de erro.
- Em listagens e fluxos de dados, preserve consistencia de filtros, ordenacao, paginacao e estado da interface quando fizer sentido.

## PERFORMANCE E EFICIENCIA

- Evite desperdicio de processamento, renders desnecessarios, recomputacoes evitaveis e re-renderizacao excessiva.
- Use memoizacao, code splitting, lazy loading e outras tecnicas de otimizacao apenas quando houver ganho real e impacto relevante no contexto do projeto.
- Priorize simplicidade primeiro; otimize com base em impacto real.

## SEGURANCA E CONFIABILIDADE

- Validar e sanitizar entradas quando aplicavel.
- Nao expor segredos, tokens, credenciais ou dados sensiveis no cliente.
- Nunca confiar apenas na validacao do frontend para regras criticas.
- Tratar erros de forma controlada, consistente e segura.
- Preservar comportamento previsivel da interface mesmo em cenarios de erro.

## REGRAS ESPECIFICAS DO FRONTEND

### ARQUITETURA FRONTEND

- Componentes devem ter responsabilidade unica.
- Separe apresentacao, estado e acesso a dados quando fizer sentido.
- Evite componentes grandes demais.
- Evite props drilling excessivo quando houver alternativa apropriada.
- Evite acesso a dados diretamente em componentes puramente visuais.
- Nao mutar estado diretamente; use atualizacoes imutaveis quando aplicavel.

### UX E QUALIDADE

- Tratar estados de loading, erro e vazio.
- Garantir responsividade em mobile e desktop.
- Garantir acessibilidade quando aplicavel.
- Preservar consistencia visual com design system, tokens e componentes do projeto.

### PERFORMANCE FRONTEND

- Evite renders desnecessarios.
- Use memoizacao apenas quando houver ganho real.

### SE O PROJETO USAR REACT

- Componentes devem ter responsabilidade unica.
- Separe apresentacao, estado e acesso a dados quando fizer sentido.
- Evite componentes grandes demais.
- Preserve consistencia entre componentes, hooks e fluxo de dados.
- Evite lógica de dados espalhada por componentes visuais.

### VALIDACAO FRONTEND

- Sempre que possivel, executar testes, lint, build, typecheck e validacoes locais relevantes antes de concluir.
- Se nao for possivel validar localmente, informar claramente o que nao foi validado.

## DOCUMENTACAO

- Quando a mudanca alterar comportamento, fluxo operacional, configuracao ou uso do sistema, atualize a documentacao relevante se existir.
- Se houver pasta `docs/`, README tecnico ou guias internos, mantenha-os consistentes com a implementacao.
- Sinalize quando uma mudanca exigir documentacao adicional fora do escopo atual.

## REGRAS DE ENTREGA

- Antes de finalizar, revise impacto funcional, tecnico e de compatibilidade.
- Verifique se a implementacao respeita a arquitetura e os padroes existentes.
- Sinalize riscos residuais, premissas adotadas e pontos que exigem atencao em review.
- Nao considerar a tarefa concluida se houver quebra evidente de contrato, risco alto de regressao ou validacao critica ausente sem aviso.

# Sugestão de Commit

Ao finalizar qualquer resposta que envolva criação, alteração ou remoção de código, a resposta deve encerrar na seguinte ordem:

1. Sugestão de commit
2. Resumo do que foi alterado (conforme seção WORKFLOW)

A sugestão de commit deve seguir o formato:

```bash
<descricao curta em pt-BR>
```

A descrição deve ser clara, no imperativo e em pt-BR.

Exemplos:

```bash
adiciona grafico de vendas com filtro por periodo
corrige bug de validacao no formulario
refatora componente de lista de usuarios
```

## CHECKLIST PARA CODE REVIEW

- Ha risco de regressao funcional, visual ou de contrato?
- A entrada foi validada nos pontos criticos?
- Existe risco de duplicacao de regra, fonte de verdade concorrente ou acoplamento desnecessario?
- Existe risco evidente de performance, renderizacao desnecessaria ou gargalo evitavel?
- O tratamento de erro esta consistente e sem vazamento de informacoes sensiveis?
- O codigo esta legivel, coeso, consistente com o projeto e sem duplicacao desnecessaria?
- Estados de loading, erro, vazio, acessibilidade e responsividade foram tratados quando aplicavel ao contexto?
