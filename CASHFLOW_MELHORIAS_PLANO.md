# Plano de Implementação — Melhorias do Fluxo de Caixa

## Diagnóstico: O Que Já Está Implementado vs. O Que Falta

| # | Feature | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Métodos de Pagamento (PIX, Cartão, etc.) | ✅ **JÁ EXISTE** | `PaymentMethod` enum no schema + campo `paymentMethod?` em `CashFlowTransaction` + DTO já aceita |
| 2 | Categorização de Receitas/Despesas | ❌ **FALTANDO** | Nenhum enum `category` nem campo equivalente existe |
| 3 | Status da Transação (Contas a Pagar/Receber) | ❌ **FALTANDO** | O modelo assume pagamento imediato. Sem `status`, `dueDate` ou `paymentDate` |
| 4 | Auto-criação de CashFlow ao pagar comissões | ✅ **JÁ EXISTE** | `employee.service.ts` → `payCommissions()` cria `CashFlowTransaction EXPENSE` automaticamente |
| 5 | PDV - Venda Avulsa de Produtos (sem agendamento) | ❌ **FALTANDO** | Não existe endpoint de venda direta. `Products` só é usado em `ConsumedItems` |

---

## O Que Será Implementado

### Feature 2 — Categorização (Plano de Contas)

**Impacto:** Permite geração de DRE, gráficos por categoria e controle gerencial real.

#### `prisma/schema.prisma`
```prisma
// Novo enum adicionado
enum TransactionCategory {
  SERVICO_PRESTADO      // Faturamento de atendimentos
  VENDA_PRODUTO         // Venda de produtos de prateleira (PDV)
  PAGAMENTO_COMISSAO    // Saída de pagamento de comissão a funcionário
  COMPRA_INSUMOS        // Compra de materiais/produtos para uso interno
  ALUGUEL               // Despesa fixa de espaço
  AGUA_LUZ              // Despesa fixa de utilidades
  MARKETING             // Gastos com publicidade e promoção
  SALARIO               // Pagamento de salário fixo (não comissão)
  OUTROS                // Categoria genérica para exceções
}

// Campos adicionados em CashFlowTransaction
model CashFlowTransaction {
  ...
  category      TransactionCategory?       // <-- NOVO
}
```

#### `src/cash-flow/dto/create-cash-flow.dto.ts`
- Adicionar campo `@IsEnum(TransactionCategory) @IsOptional() category?: TransactionCategory`

#### `src/cash-flow/cash-flow.service.ts`
- Atualizar `getBalance()` para aceitar filtro por `category`
- Atualizar `getDashboardStats()` para retornar breakdown por categoria (dados para DRE)

#### `src/employee/employee.service.ts`
- Atualizar `payCommissions()` para marcar as transações com `category: 'PAGAMENTO_COMISSAO'`

#### `src/customer-service/customer-service.service.ts`
- Atualizar o lançamento automático de INCOME para usar `category: 'SERVICO_PRESTADO'`

---

### Feature 3 — Status de Transação (Contas a Pagar/Receber)

**Impacto:** Permite previsão de fluxo de caixa, cadastrar contas antes do vencimento, e saber o que ainda está pendente.

#### `prisma/schema.prisma`
```prisma
enum TransactionStatus {
  PAID      // Liquidado — entra no cálculo de caixa real
  PENDING   // Agendado/Futuro — entra apenas na previsão
  CANCELED  // Cancelado — ignorado pelo sistema
}

// Campos adicionados em CashFlowTransaction
model CashFlowTransaction {
  ...
  status       TransactionStatus  @default(PAID)    // <-- NOVO
  dueDate      DateTime?                             // <-- NOVO (data de vencimento)
  paymentDate  DateTime?                             // <-- NOVO (data do pagamento real)
}
```

#### Impacto nos serviços:
- `getBalance()`: filtrar apenas `status: PAID` para saldo real; criar endpoint `getForecast()` que inclui `PENDING`
- `findAll()`: aceitar filtro por `status` no `CashFlowFilterDto`
- Novo endpoint `PATCH /cash-flow/:id/pay` para marcar uma transação pendente como paga (seta `paymentDate` e `status: PAID`)
- Lançamentos automáticos do sistema (comissões, atendimentos) continuam criando com `status: PAID` por padrão

---

### Feature 5 — PDV (Ponto de Venda Avulso)

**Impacto:** Permite registrar receita de venda de produtos de home care sem precisar criar um agendamento.

#### `src/products/` — Novo endpoint no controller
```
POST /products/sell
```

#### `src/products/dto/sell-product.dto.ts` `[NEW]`
```ts
class SellProductDto {
  productId: string   // UUID do produto
  quantity: number    // Quantidade vendida
  unitPrice?: number  // Permite desconto/promoção (opcional, usa price do cadastro)
  paymentMethod?: PaymentMethod
}
```

#### `src/products/products.service.ts`
- Novo método `sellProduct(dto)`:
  1. Busca o produto e valida estoque
  2. Decrementa `stock`
  3. Cria `CashFlowTransaction` com `type: INCOME`, `category: VENDA_PRODUTO`, `paymentMethod`, `amount: qty * unitPrice`
  4. Retorna o resumo da venda

---

## Ordem de Execução Sugerida

```
Etapa 1: Schema (migration única)
  → Adicionar TransactionCategory, TransactionStatus, dueDate, paymentDate
  → Rodar npx prisma migrate dev

Etapa 2: DTOs e Serviços de CashFlow (sem breaking changes)
  → Atualizar create-cash-flow.dto.ts
  → Atualizar cash-flow.service.ts (filtros + getDashboardStats com breakdown)
  → Novo endpoint PATCH /cash-flow/:id/pay

Etapa 3: Propagar category nos lançamentos automáticos
  → customer-service.service.ts → SERVICO_PRESTADO
  → employee.service.ts → PAGAMENTO_COMISSAO

Etapa 4: PDV
  → Criar sell-product.dto.ts
  → Adicionar sellProduct() no products.service.ts
  → Registrar rota POST /products/sell no products.controller.ts
```

---

> [!IMPORTANT]
> A **Etapa 1 requer uma migration** do Prisma. Todos os campos novos são opcionais (`?`) ou têm `@default`, então **não há risco de quebra de dados existentes**.
>
> Aguarde sua aprovação (`"pode executar"`) para iniciar.
