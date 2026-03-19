import {A, M} from "../index.js"

export type JournalInfo = {
  startDate: Date
  endDate: Date
  accounts: Accounts
  budget: Budget
}

export type Accounts = {
  accounts: Array<Account>
}

export type Account = {
  id: string
  parentId?: string
  name: string
  displayName?: string
  creditOrDebit: A.JournalConfig.CreditOrDebit
  description?: string
  balanceAsOf?: A.JournalConfig.BalanceAsOf
}

export type Budget = {
  entries: Array<A.ScheduledEntry.NormalizedScheduledEntry>
}
