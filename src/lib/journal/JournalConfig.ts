import {A, M} from "../index.js"

export interface JournalConfig {
  startDate: Date
  endDate: Date
  journalDir: string
  chartOfAccounts: Array<Account>
  scheduledEntries?: Array<A.ScheduledEntry.ScheduledEntry>
  classificationRules: Array<M.ClassificationRule>
}

export interface Account {
  id: string
  parent?: string
  name: string
  displayName?: string
  creditOrDebit?: CreditOrDebit
  description?: string
}

export type CreditOrDebit = "credit" | "debit"
export type BudgetOrActual = "budget" | "actual"

export type JournalConfigsByName = {[name:string]:()=>JournalConfig}
