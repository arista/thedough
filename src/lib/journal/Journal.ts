import {A, M} from "../index.js"

export type JournalEntryLine = JournalEntry | RevertJournalEntry

// An entry in the "journal.jsonl" file
export interface JournalEntry {
  type: "JournalEntry"
  createdAt: string
  id: string
  date: string
  memo?: string | null
  sourceTransactionId?: string
  accounts: Array<JournalEntryAccount>
}

// An entry in the journal indicating that a previous journal entry
// should be removed
export interface RevertJournalEntry {
  type: "RevertJournalEntry"
  createdAt: string
  journalEntryId: string
}

export interface JournalEntryAccount {
  accountId: string
  creditOrDebit: A.JournalConfig.CreditOrDebit
  currency: string
  amountInCents: number
}

export function addJournalEntries({
  model,
  entries,
  startDate,
  endDate,
}: {
  model: M.Model
  entries: Array<JournalEntryLine>
  startDate: Date
  endDate: Date
}) {
  for (const entry of entries) {
    addJournalEntry({model, entry, startDate, endDate})
  }
}

export function addJournalEntry({
  model,
  entry,
  startDate,
  endDate,
}: {
  model: M.Model
  entry: JournalEntryLine
  startDate: Date
  endDate: Date
}) {
  switch (entry.type) {
    case "JournalEntry": {
      const {id, createdAt, date, memo, sourceTransactionId, accounts} = entry
      const d = new Date(Date.parse(date))
      if (d >= startDate && d < endDate) {
        const journalEntry = model.entities.JournalEntry.add({
          id,
          date,
          memo,
          sourceTransactionId,
          budgetOrActual: "actual",
          createdAt: new Date(Date.parse(date)).toISOString(),
        })
        for (const journalEntryAccount of accounts) {
          const {accountId, creditOrDebit, amountInCents, currency} =
            journalEntryAccount
          const accountEntry = model.entities.JournalEntryAccount.add({
            journalEntryId: journalEntry.id,
            accountId,
            creditOrDebit,
            currency,
            amountInCents,
          })
        }
      }
      break
    }
    case "RevertJournalEntry": {
      const {journalEntryId} = entry
      const journalEntry =
        model.entities.JournalEntry.byId.tryGet(journalEntryId)
      if (journalEntry != null) {
        journalEntry.remove()
      }
      break
    }
    default:
      const unexpected: never = entry
  }
}
