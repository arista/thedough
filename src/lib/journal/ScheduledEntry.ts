import {A, M} from "../index.js"
import later from "@breejs/later"

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

export interface NormalizedScheduledEntry {
  type: "ScheduledEntry"
  id: string
  accounts: Array<NormalizedScheduledEntryAccount>
  schedule: string
  memo?: string
}

export interface NormalizedScheduledEntryAccount {
  accountId: string
  creditOrDebit: A.JournalConfig.CreditOrDebit
  amountInCents: number
  currency: string
}

export function addScheduledJournalEntries({
  entries,
  startDate,
  endDate,
  model,
  budgetOrActual,
}: {
  entries: Array<ScheduledEntry>
  startDate: Date
  endDate: Date
  model: M.Model
  budgetOrActual: A.JournalConfig.BudgetOrActual
}) {
  for (const entry of entries) {
    const nentry = normalizeScheduledEntry(model, entry)
    const {schedule, memo} = entry
    const sched = later.parse.text(schedule)
    const {exceptions, error} = sched
    if (error >= 0) {
      throw new Error(
        `Invalid schedule for entry ${entry.id}: "${schedule}", JSON.stringify({exceptions, error})`
      )
    }
    const laterSchedule = later.schedule(sched)
    const instances = laterSchedule.next(366, startDate, endDate)
    if (Array.isArray(instances)) {
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i]
        addScheduledJournalEntry(model, nentry, instance, i, budgetOrActual)
      }
    }
  }
}

export function addScheduledJournalEntry(
  model: M.Model,
  entry: NormalizedScheduledEntry,
  date: Date,
  num: number,
  budgetOrActual: A.JournalConfig.BudgetOrActual
) {
  const {id, memo} = entry
  const entryDate = A.DateUtils.toYYYY_MM_DD(date)
  const entryId = `scheduled-${id}-${entryDate}-${num}`
  const journalEntry = model.entities.JournalEntry.add({
    id: entryId,
    date: entryDate,
    memo,
    budgetOrActual,
    createdAt: date.toISOString(),
  })
  for (const scheduledEntryAccount of entry.accounts) {
    const {accountId, creditOrDebit, amountInCents, currency} =
      scheduledEntryAccount
    const accountEntry = model.entities.JournalEntryAccount.add({
      journalEntryId: journalEntry.id,
      accountId,
      creditOrDebit,
      currency,
      amountInCents,
    })
  }
}

export function normalizeScheduledEntry(
  model: M.Model,
  entry: ScheduledEntry
): NormalizedScheduledEntry {
  const currencies = new Set<string>()
  let creditsInCents: number = 0
  let debitsInCents: number = 0
  const entryAccountsWithAmount: Array<ScheduledEntryAccount> = []
  const entryAccountsWithoutAmount: Array<ScheduledEntryAccount> = []
  const accountsByEntryAccount = new Map<
    ScheduledEntryAccount,
    A.Model.entities.Account
  >()

  for (const entryAccount of entry.accounts) {
    // Find the account
    const accountName = entryAccount.account
    const account = A.Utils.notNull(
      A.Accounts.findAccount(model, accountName),
      `scheduled Account "${accountName}" for entry "${entry.id}"`
    )
    accountsByEntryAccount.set(entryAccount, account)

    // Record the credit/debit, keeping track of any accounts
    const {amountInCents} = entryAccount
    if (amountInCents == null) {
      entryAccountsWithoutAmount.push(entryAccount)
    } else {
      entryAccountsWithAmount.push(entryAccount)
      switch (account.actualCreditOrDebit) {
        case "credit":
          if (amountInCents >= 0) {
            creditsInCents += amountInCents
          } else {
            debitsInCents += amountInCents
          }
          break
        case "debit":
          if (amountInCents >= 0) {
            debitsInCents += amountInCents
          } else {
            creditsInCents += amountInCents
          }
          break
        default:
          const unexpected: never = account.actualCreditOrDebit
          break
      }
    }

    // See if the currency matches
    if (entryAccount.currency != null) {
      currencies.add(entryAccount.currency)
    }
  }

  // Check the results
  if (entryAccountsWithoutAmount.length > 1) {
    throw new Error(
      `scheduled entry "${entry.id}" may specify at-most one account that doesn't specify an amountInCents`
    )
  }
  if (entryAccountsWithAmount.length === 0) {
    throw new Error(
      `scheduled entry "${entry.id}" does not specify any accounts with an amountInCents`
    )
  }
  const entryAccountWithoutAmount =
    entryAccountsWithoutAmount.length === 0
      ? null
      : entryAccountsWithoutAmount[0]

  if (entryAccountWithoutAmount == null && creditsInCents !== debitsInCents) {
    throw new Error(
      `scheduled entry "${entry.id}" does not have equal creditsInCents (${creditsInCents}) and debitsInCents (${debitsInCents})`
    )
  }

  if (currencies.size > 1) {
    throw new Error(
      `scheduled entry "${entry.id}" specifies multiple currencies`
    )
  }
  const currency = [...currencies][0] ?? "USD"

  // Now go through and fill in the accounts
  const accounts: Array<NormalizedScheduledEntryAccount> = []

  for (const entryAccount of entry.accounts) {
    const account = A.Utils.notNull(accountsByEntryAccount.get(entryAccount))
    const {creditOrDebit, amountInCents} = computeAmount(
      entryAccount,
      account,
      creditsInCents,
      debitsInCents
    )
    accounts.push({
      accountId: account.id,
      creditOrDebit,
      amountInCents,
      currency,
    })
  }

  const {schedule, memo, id} = entry
  return {
    type: "ScheduledEntry",
    id,
    accounts,
    schedule,
    memo,
  }
}

function computeAmount(
  entryAccount: ScheduledEntryAccount,
  account: A.Model.entities.Account,
  creditsInCents: number,
  debitsInCents: number
): {
  creditOrDebit: A.JournalConfig.CreditOrDebit
  amountInCents: number
} {
  // If the amount is specified, then normalize to a positive amount
  // and credit/debit
  if (entryAccount.amountInCents != null) {
    switch (account.actualCreditOrDebit) {
      case "credit":
        if (entryAccount.amountInCents >= 0) {
          return {
            creditOrDebit: "credit",
            amountInCents: entryAccount.amountInCents,
          }
        } else {
          return {
            creditOrDebit: "debit",
            amountInCents: -entryAccount.amountInCents,
          }
        }
        break
      case "debit":
        if (entryAccount.amountInCents >= 0) {
          return {
            creditOrDebit: "debit",
            amountInCents: entryAccount.amountInCents,
          }
        } else {
          return {
            creditOrDebit: "credit",
            amountInCents: -entryAccount.amountInCents,
          }
        }
        break
      default:
        const unexpected: never = account.actualCreditOrDebit
        throw new Error(`Assertion failed: unexpected value`)
    }
  }

  // If the amount isn't specified, then have it take the difference
  // between the existing credits and debits
  else {
    if (creditsInCents >= debitsInCents) {
      return {
        creditOrDebit: "debit",
        amountInCents: creditsInCents - debitsInCents,
      }
    } else {
      return {
        creditOrDebit: "credit",
        amountInCents: debitsInCents - creditsInCents,
      }
    }
  }
}
