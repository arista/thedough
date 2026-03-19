import {A, M} from "../index.js"

export interface BudgetConfig {
  startDate: Date
  endDate: Date
  entries: Array<A.ScheduledEntry.ScheduledEntry>
}

export interface NormalizedBudgetConfig {
  startDate: Date
  endDate: Date
  entries: Array<A.ScheduledEntry.NormalizedScheduledEntry>
}

export type BudgetConfigsByName = {[name:string]:()=>BudgetConfig}
