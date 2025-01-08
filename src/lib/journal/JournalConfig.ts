import {A, M} from "../index.js"

export interface JournalConfig {
  startDate: Date
  endDate: Date
  journalDir: string
  chartOfAccounts: Array<Account>
  scheduledSourceTransactions?: Array<ScheduledSourceTransaction>
  classificationRules: Array<M.ClassificationRule>
}

export interface Account {
  id: string
  parent?: string
  name: string
  displayName?: string
  creditOrDebit?: CreditOrDebit
  description?: string
  balanceAsOf?: BalanceAsOf
}

export type CreditOrDebit = "credit" | "debit"
export type BudgetOrActual = "budget" | "actual"

export type JournalConfigsByName = {[name: string]: () => JournalConfig}

export interface ScheduledSourceTransaction {
  type: "ScheduledSourceTransction"
  id: string
  account: string
  amountInCents: number
  currency?: string
  schedule: string
  name: string
  description: string
}

export interface BalanceAsOf {
  date: string
  balances: Array<Balance>
}

export interface Balance {
  currency: string
  actualBalanceInCents: number
  budgetBalanceInCents: number
}
