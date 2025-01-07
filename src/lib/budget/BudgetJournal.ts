import {A, M} from "../index.js"
import later from "@breejs/later"

export function addBudgetJournalEntries({
  configName,
  model,
}: {
  configName: string
  model: M.Model
}) {
  console.log(`Using configuration "${configName}" found in BudgetConfigs.ts`)
  const budgetConfigFn = A.Utils.notNull(
    M.BudgetConfigs[configName],
    `searching BudgetConfigs.ts for "${configName}"`
  )
  const budgetConfig = budgetConfigFn()
  const {startDate, endDate, entries} = budgetConfig

  A.ScheduledEntry.addScheduledJournalEntries({
    entries,
    startDate,
    endDate,
    model,
    budgetOrActual: "budget",
  })
}
