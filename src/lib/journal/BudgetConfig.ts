import {A, M} from "../index.js"

export interface BudgetConfig {
  startDate: Date
  endDate: Date
  entries: Array<A.ScheduledEntry.ScheduledEntry>
}

export type BudgetConfigsByName = {[name:string]:()=>BudgetConfig}
