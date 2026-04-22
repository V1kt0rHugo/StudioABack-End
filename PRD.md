# Product Requirements Document (PRD) - Studio A Backend

## 1. Visão Geral
Este documento detalha os requisitos para a evolução do sistema de gestão para o **Studio A**. Baseado na arquitetura atual (NestJS + Prisma + PostgreSQL), este PRD tem como objetivo guiar o desenvolvimento das novas funcionalidades solicitadas, garantindo que o banco de dados e a de lógica de negócios suportem as operações diárias de um salão/estúdio de beleza de forma escalável.

---

## 2. Requisitos Funcionais (RFs) e Épicos

### Épico 1: Gestão de Clientes e Fichas
**Objetivo:** Ter um cadastro completo de clientes, com ficha individual e histórico detalhado.
- **RF 1.1 - Cadastro Ampliado:** O modelo `Client` deve conter dados de contato completos, notas sobre alergias/restrições e métricas do cliente.
- **RF 1.2 - Ficha Individual e Histórico:** O sistema deve fornecer um endpoint capaz de listar todos os atendimentos (`CustomerService`) de um cliente específico, ordenados por data decrescente.
- **RF 1.3 - Cálculos de Frequência:** No retorno do histórico do cliente, a API deve processar "quando foi o último procedimento" e "quanto tempo já passou" baseando-se no campo `Date` da model `CustomerService`.

### Épico 2: Gestão de Atendimentos e Estoque
**Objetivo:** Registrar cada atendimento detalhando serviços, produtos e automatizando o estoque.
- **RF 2.1 - Atendimento aprimorado:** O registro de atendimento (`CustomerService`) precisará de validações explícitas de quando for concluído.
- **RF 2.2 - Utilização de Produtos:** O sistema utilizará a tabela atual `ConsumedItems` (que já mapeia `idCustomerService`, `idProduct`, `usedQuantity`) durante a inserção de um atendimento. A quantidade deve suportar fracionamento (caso seja ML/Gramas). Se o tipo `Int` limitar as medições rigorosas (ex: 30,5 ml), deverá ser migrado para `Float`.
- **RF 2.3 - Baixa Automática de Estoque:** Ao mudar o status do `CustomerService` para `COMPLETED` (já contido no enum existente), o back-end aplicará automaticamente um decremento no valor `stock` na tabela `Products` baseado no `usedQuantity` em `ConsumedItems`.
- **RF 2.4 - Controle de Estorno em Estoques:** Prever a reversão (devolução) do item ao estoque caso um atendimento mude de `COMPLETED` para `CANCELED`.

### Épico 3: Financeiro - Caixa e Comissões
**Objetivo:** Trazer controle total das finanças de entrada e comissionamentos.
- **RF 3.1 - Módulo de Caixa / Cash Flow:** Criar uma nova tabela `CashFlowTransaction` para gerir entradas e futuras saídas.
  - *Tabela Nova:* Relacionará com o `CustomerService` (Entrada por atendimento), além de suportar inserção avulsa.
- **RF 3.2 - Apuração de Comissões:** Hoje temos `commissionValue` em `PerformedServices`. Precisaremos de um endpoint de relatórios (`GET /employees/:id/commissions?startDate=X&endDate=Y`).
- **RF 3.3 - Resumo do Relatório:** O backend retornará o valor total no período informado e uma lista analítica de atendimentos que o geraram.

### Épico 4: Pós-Venda e Lembretes
**Objetivo:** Fidelizar o cliente lembrando-o de retornar.
- **RF 4.1 - Parametrização de Lembrete:** Na model `Services`, prever qual o tempo em dias para refazer aquele procedimento. `Ex: Tintura -> 45 dias`. No `Services`, incluir um campo `returnDaysReminder` em inteiro.
- **RF 4.2 - Geração do Relatório de Retorno:** A API deve expor um endpoint (ex: `GET /clients/reminders`) que cruze dados: *"Últimos serviços que já passaram ou estão próximos do 'returnDaysReminder'."* 

---

## 3. Proposed Changes (Mudanças Sugeridas no Código)

As seguintes mudanças serão guiadas pelas necessidades atuais com impacto mínimo nas coisas já funcionais (baseado na estrutura Prisma atual):

### Banco de Dados (`schema.prisma`)
#### Modificações:
- Adicionar ao `Client`: `phone String?`, `birthDate DateTime?`, `notes String?`.
- Alterar em `Products`: Mudar `stock Int` para `stock Float` para comportar fracionamento (ex: ML).
- Alterar em `ConsumedItems`: Mudar `usedQuantity Int` para `usedQuantity Float`.
- Adicionar ao `Services`: `returnDaysReminder Int? @default(0)`.
- Criar Nova Tabela: `CashFlowTransaction` ligada opcionalmente ao `CustomerService`.

```prisma
// Exemplo de Migração Necessária:
// 1. Ampliação do Model Client (RF 1.1)
model Client {
  // ... campos atuais
  phone            String?
  birthDate        DateTime?
  notes            String?
}

// 2. Criação da Tabela Financeira (RF 3.1)
model CashFlowTransaction {
  id                String           @id @default(uuid())
  type              TransactionType
  description       String
  amount            Float
  date              DateTime         @default(now())
  idCustomerService String?          @unique
  CustomerService   CustomerService? @relation(fields: [idCustomerService], references: [id])
}

enum TransactionType {
  INCOME
  EXPENSE
}
```

### Funcionalidade 1: Client Service (Ficha e Lembrete)
- Método `getClientHistory(id)` com Join de `CustomerServices` calculando dias passados.
- Método `getReminders()` varrendo todos os serviços.

### Funcionalidade 2: Atendimento e Estoque
- Ajustar método de `updateStatus` do `CustomerService`. Se `COMPLETED`, dispara transações que iteram por item consumido e debitam do banco em `Products.stock`.

### Funcionalidade 3: Comissões 
- Adicionado endpoint analítico em `employee.service.ts` e somatória baseada em Date Range.

## 4. Plano de Fases e Verificação

### Fase 1: Fundação do Cliente e Histórico
1. Adicionar `phone`, `birthDate` e `notes` no Cliente. Rodar migração Prisma (`prisma migrate dev`).
2. Criar método `getClientHistory(idClient)` transformando/processando datas e histórico de cliente.

### Fase 2: Atendimentos, Produtos e Estoque
1. Atualizar e migrar os dados de fracionamento de estoque e quantidade gasta, visando a medição (ML, gr).
2. Lógica no status update do atendimento para subtrair itens do estoque via Transação protegida do banco.

### Fase 3: Controle de Caixa e Comissões
1. Nova model `CashFlowTransaction`, fluxo de inserção.
2. Relatórios de extrato e comissão em `employee`.

### Fase 4: Inteligência (Lembretes)
1. Criação do método de aviso que varre dias passados cruzando com `returnDaysReminder` e diz quem ligar hoje.
