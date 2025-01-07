import {A, M} from "../index.js"

export interface BudgetConfig {
  startDate: Date
  endDate: Date
  entries: Array<A.ScheduledEntry.ScheduledEntry>
}

export type BudgetConfigEntry = ScheduledEntry

export interface ScheduledEntry {
  type: "ScheduledEntry"
  id: string
  accounts: Array<ScheduledEntryAccount>
  schedule: string
  memo?: string
}

export interface ScheduledEntryAccount {
  account: string
  amountInCents?: number
  currency?: string
}
