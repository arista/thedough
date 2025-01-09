import {A, M} from "../index.js"

export function createModel(): M.Model {
  return M.createModel({
    entities: {
      Account: {
        computed: {
          actualCreditOrDebit: (a) => {
            if (a.creditOrDebit != null) {
              return a.creditOrDebit
            }
            if (a.parent == null) {
              return "credit"
            } else {
              return a.parent.actualCreditOrDebit
            }
          },
        },
      },
      AccountEntry: {
        computed: {
          date: (a) => a.journalEntryAccount.journalEntry.date,
          budgetOrActual: (a) =>
            a.journalEntryAccount.journalEntry.budgetOrActual,
          isActual: (a) => a.budgetOrActual === "actual",
        },
      },
      JournalEntryAccount: {
        computed: {
          budgetOrActual: (a) => a.journalEntry.budgetOrActual,
          isActual: (a) => a.budgetOrActual === "actual",
        },
      },
    },
  })
}

export function postProcessModel({model}: {model: M.Model}) {
  addAccountEntryEntities({model})
  computeCurrentBalances({model})
  computeRunningBalances({model})
  incorporateBalancesAsOf({model})
}

// The JournalEntries are for specific accounts, but the effects of
// those entries should appear in all of an account's ancestors as
// well.  The AccountEntry entities represent this.
function addAccountEntryEntities({model}: {model: M.Model}) {
  for (const jea of model.entities.JournalEntryAccount.all.entitiesArray) {
    for (
      let account: A.Model.entities.Account | null = jea.account;
      account != null;
      account = account.parent
    ) {
      model.entities.AccountEntry.add({
        accountId: account.id,
        journalEntryAccountId: jea.id,
      })
    }
  }
}

// Calculate the current balances of all the accounts
function computeCurrentBalances({model}: {model: M.Model}) {
  for (const account of model.entities.Account.all.entities) {
    const accountCreditOrDebit = account.actualCreditOrDebit
    for (const entry of account.allEntries.byDate.entities) {
      const {creditOrDebit, amountInCents, currency, journalEntry} =
        entry.journalEntryAccount
      const {budgetOrActual} = journalEntry
      const balance = getOrCreateCurrentBalance(model, account, currency)
      const balanceAdjust =
        creditOrDebit === accountCreditOrDebit ? amountInCents : -amountInCents
      switch (budgetOrActual) {
        case "budget":
          balance.budgetBalanceInCents += balanceAdjust
          break
        case "actual":
          balance.actualBalanceInCents += balanceAdjust
          break
        default:
          const unexpected: never = budgetOrActual
          break
      }
    }
  }
}

// Calculate the running balance associated with every AccountEntry
function computeRunningBalances({model}: {model: M.Model}) {
  for (const account of model.entities.Account.all.entities) {
    const balancesByCurrency = new Map<string, Balances>()
    balancesByCurrency.set("USD", {actual: 0, budget: 0})
    const accountCreditOrDebit = account.actualCreditOrDebit

    // Go through each entry
    for (const entry of account.allEntries.byDate.entities) {
      const {creditOrDebit, amountInCents, currency, journalEntry} =
        entry.journalEntryAccount
      const {budgetOrActual} = journalEntry

      // Update the balances
      const balanceAdjust =
        creditOrDebit === accountCreditOrDebit ? amountInCents : -amountInCents
      const balances = balancesByCurrency.get(currency) ?? {
        actual: 0,
        budget: 0,
      }
      const newBalances = (() => {
        switch (budgetOrActual) {
          case "budget":
            return {
              budget: balances.budget + balanceAdjust,
              actual: balances.actual,
            }
          case "actual":
            return {
              budget: balances.budget,
              actual: balances.actual + balanceAdjust,
            }
          default:
            const unexpected: never = budgetOrActual
            throw new Error(`Unexpected value`)
        }
      })()
      balancesByCurrency.set(currency, newBalances)

      // Associate the new set of balances with the entry
      for (const [currency, balances] of balancesByCurrency) {
        model.entities.RunningAccountBalance.add({
          accountEntryId: entry.id,
          currency,
          actualBalanceInCents: balances.actual,
          budgetBalanceInCents: balances.budget,
        })
      }
    }
  }
}

interface Balances {
  actual: number
  budget: number
}

function getOrCreateCurrentBalance(
  model: M.Model,
  account: A.Model.entities.Account,
  currency: string
): A.Model.entities.CurrentAccountBalance {
  const balance = account.currentBalances.byCurrency.tryGet(currency)
  if (balance != null) {
    return balance
  } else {
    const newBalance = model.entities.CurrentAccountBalance.add({
      accountId: account.id,
      currency,
      budgetBalanceInCents: 0,
      actualBalanceInCents: 0,
    })
    return newBalance
  }
}

function getOrCreateRunningBalance(
  model: M.Model,
  accountEntry: A.Model.entities.AccountEntry,
  currency: string
): A.Model.entities.RunningAccountBalance {
  const balance = accountEntry.runningBalances.byCurrency.tryGet(currency)
  if (balance != null) {
    return balance
  } else {
    const newBalance = model.entities.RunningAccountBalance.add({
      accountEntryId: accountEntry.id,
      currency,
      budgetBalanceInCents: 0,
      actualBalanceInCents: 0,
    })
    return newBalance
  }
}

function incorporateBalancesAsOf({model}: {model: M.Model}) {
  for (const account of model.entities.Account.all.entities) {
    for (const balanceAsOf of account.balancesAsOf.byCurrency.entities) {
      const {date, currency, actualBalanceInCents, budgetBalanceInCents} =
        balanceAsOf
      // Get what we think the current balance is, and the difference
      // between that and the specified balance
      const runningBalance = getRunningBalanceAsOf({account, currency, date})
      if (runningBalance != null) {
        const adjustActual = actualBalanceInCents - runningBalance.actual
        const adjustBudget = budgetBalanceInCents - runningBalance.budget

        // Adjust all of the entries
        for (const entry of account.allEntries.byDate.entities) {
          for (const b of entry.runningBalances.byCurrency.entities) {
            if (b.currency === currency) {
              b.actualBalanceInCents += adjustActual
              b.budgetBalanceInCents += adjustBudget
            }
          }
        }

        // Adjust the account's current balance
        for (const b of account.currentBalances.byCurrency.entities) {
          if (b.currency === currency) {
            b.actualBalanceInCents += adjustActual
            b.budgetBalanceInCents += adjustBudget
          }
        }
      }
    }
  }
}

function getRunningBalanceAsOf({
  account,
  currency,
  date,
}: {
  account: A.Model.entities.Account
  currency: string
  date: string
}): Balances | null {
  let ret: Balances | null = null
  let lastDate: string | null = null
  for (const entry of account.allEntries.byDate.entities) {
    if (entry.date < date && (lastDate == null || entry.date >= lastDate)) {
      for (const b of entry.runningBalances.byCurrency.entities) {
        if (b.currency === currency) {
          ret = {
            actual: b.actualBalanceInCents,
            budget: b.budgetBalanceInCents,
          }
        }
      }
      lastDate = entry.date
    }
  }
  return ret
}
