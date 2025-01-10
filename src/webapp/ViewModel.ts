import {A, M} from "../lib/index.js"
import {LiveValue} from "live-value"

export class Journal {
  constructor(
    public model: M.Model,
    public accounts: Accounts,
    public accountsById: Map<string, Account>
  ) {}

  closeAll() {
    for (const account of this.accountsById.values()) {
      account.open.value = false
      account.entries.open.value = false
      account.allEntries.open.value = false
      account.budgetAndActualEntries.open.value = false
    }
  }

  openAccountWithId(id: string) {
    const account = this.accountsById.get(id)
    if (account == null) {
      throw new Error(`No account with id "${id}"`)
    }
    account.open.value = true
  }

  openAccountWithName(name: string) {
    const accountModel = A.Accounts.findAccount(this.model, name)
    if (accountModel == null) {
      throw new Error(`Account "${name}" is ambiguous or not found`)
    }
    this.closeAll()
    for (
      let a: A.Model.entities.Account | null = accountModel;
      a != null;
      a = a.parent
    ) {
      const account = this.accountsById.get(a.id)
      if (account != null) {
        account.open.value = true
      }
    }
  }

  static fromModel(model: M.Model): Journal {
    const accountsById = new Map<string, Account>()
    const onNewAccount = (id: string, account: Account) => {
      accountsById.set(id, account)
    }

    const accountsList = model.entities.Account.byParentAccountId
      .get(null)
      .inOrder.entitiesArray.map((a) =>
        Account.fromAccount(model, a, onNewAccount)
      )
    const defaultAccountsSort: AccountsSortKey = {
      property: "original",
      direction: "asc",
    }
    const accounts = new Accounts(accountsList, defaultAccountsSort)

    return new Journal(model, accounts, accountsById)
  }
}

export class Accounts {
  constructor(accounts: Array<Account>, sort: AccountsSortKey) {
    this._accountsProp = accounts
    this.sort = new LiveValue(sort)
    this.accounts = new LiveValue(() =>
      Accounts.sortAccounts(this._accountsProp, this.sort.value)
    )
  }

  sort: LiveValue<AccountsSortKey>
  accounts: LiveValue<Array<Account>>

  _accountsProp: Array<Account>

  static sortAccounts(
    accounts: Array<Account>,
    sort: AccountsSortKey
  ): Array<Account> {
    const ret = accounts.slice()
    const {property, direction} = sort
    switch (property) {
      case "original":
        break
      case "name":
        A.Utils.sortBy(ret, (a) => [a.name, a.id], direction === "asc")
        break
      case "actualBalance":
        A.Utils.sortBy(
          ret,
          (a) => [a.actualBalanceForSorting, a.id],
          direction === "asc"
        )
        break
      case "budgetBalance":
        A.Utils.sortBy(
          ret,
          (a) => [a.budgetBalanceForSorting, a.id],
          direction === "asc"
        )
        break
      case "overbudget":
        A.Utils.sortBy(
          ret,
          (a) => [a.overbudgetForSorting, a.id],
          direction === "asc"
        )
        break
      default:
        const unexpected: never = property
        break
    }
    return ret
  }
}

export class Account {
  open = new LiveValue<boolean>(false)

  constructor(
    public id: string,
    public name: string,
    public description: string | null,
    public creditOrDebit: A.JournalConfig.CreditOrDebit,
    public actualBalances: CurrencyAmounts,
    public budgetBalances: CurrencyAmounts,
    public overbudget: CurrencyAmounts,
    public accounts: Accounts,
    public entries: AccountEntries,
    public allEntries: AccountEntries,
    public budgetAndActualEntries: AccountEntries
  ) {}

  get actualBalanceForSorting() {
    const usdCurrency = this.actualBalances.find((b) => b.currency === "USD")
    if (usdCurrency != null) {
      return usdCurrency.amountInCents
    } else if (this.actualBalances.length === 0) {
      return 0
    } else {
      return this.actualBalances[0].amountInCents
    }
  }

  get budgetBalanceForSorting() {
    const usdCurrency = this.budgetBalances.find((b) => b.currency === "USD")
    if (usdCurrency != null) {
      return usdCurrency.amountInCents
    } else if (this.budgetBalances.length === 0) {
      return 0
    } else {
      return this.budgetBalances[0].amountInCents
    }
  }

  get overbudgetForSorting() {
    const usdCurrency = this.overbudget.find((b) => b.currency === "USD")
    if (usdCurrency != null) {
      return usdCurrency.amountInCents
    } else if (this.overbudget.length === 0) {
      return 0
    } else {
      return this.overbudget[0].amountInCents
    }
  }

  static fromAccount(
    model: M.Model,
    account: A.Model.entities.Account,
    onNewAccount: (id: string, account: Account) => void
  ): Account {
    const {id, name, description, actualCreditOrDebit, currentBalances} =
      account
    const actualBalances = currentBalances.byCurrency.entitiesArray.map((b) => {
      const {currency, actualBalanceInCents} = b
      return new CurrencyAmount(currency, actualBalanceInCents)
    })
    const budgetBalances = currentBalances.byCurrency.entitiesArray.map((b) => {
      const {currency, budgetBalanceInCents} = b
      return new CurrencyAmount(currency, budgetBalanceInCents)
    })
    const overbudget = subtractCurrencyAmounts(actualBalances, budgetBalances)

    const accountsList = account.children.inOrder.entitiesArray.map((a) =>
      Account.fromAccount(model, a, onNewAccount)
    )
    const defaultAccountsSort: AccountsSortKey = {
      property: "original",
      direction: "asc",
    }
    const accounts = new Accounts(accountsList, defaultAccountsSort)

    const entriesList = account.journalEntryAccounts.actuals.entitiesArray.map(
      (e) => AccountEntry.fromJournalEntryAccount(e, null)
    )
    const defaultEntriesSort: AccountEntriesSortKey = {
      property: "original",
      direction: "asc",
    }
    const entries = new AccountEntries(entriesList, defaultEntriesSort)

    const allEntriesList = account.allEntries.actuals.entitiesArray.map((ae) =>
      AccountEntry.fromJournalEntryAccount(ae.journalEntryAccount, null)
    )
    const allEntries = new AccountEntries(allEntriesList, defaultEntriesSort)

    const budgetAndActualEntriesList =
      account.allEntries.byDate.entitiesArray.map((ae) =>
        AccountEntry.fromJournalEntryAccount(ae.journalEntryAccount, ae)
      )
    const budgetAndActualEntriesSort: AccountEntriesSortKey = {
      property: "date",
      direction: "asc",
    }
    const budgetAndActualEntries = new AccountEntries(
      budgetAndActualEntriesList,
      budgetAndActualEntriesSort
    )

    const ret = new Account(
      id,
      name,
      description,
      actualCreditOrDebit,
      actualBalances,
      budgetBalances,
      overbudget,
      accounts,
      entries,
      allEntries,
      budgetAndActualEntries
    )

    onNewAccount(id, ret)

    return ret
  }
}

export class CurrencyAmount {
  constructor(
    public currency: string,
    public amountInCents: number
  ) {}

  static get defaultValue() {
    return new CurrencyAmount("USD", 0)
  }
}

export type CurrencyAmounts = Array<CurrencyAmount>

export class AccountsSortKey {
  constructor(
    public property: AccountsSortProperty,
    public direction: SortDirection
  ) {}
}

export type AccountsSortProperty =
  | "original"
  | "name"
  | "actualBalance"
  | "budgetBalance"
  | "overbudget"
export type SortDirection = "asc" | "desc"

export class AccountEntry {
  open = new LiveValue<boolean>(false)
  sourceTransactionOpen = new LiveValue<boolean>(false)

  constructor(
    public journalEntry: A.Model.entities.JournalEntry,
    public budgetOrActual: A.JournalConfig.BudgetOrActual,
    public id: string,
    public date: string,
    public creditOrDebit: A.JournalConfig.CreditOrDebit,
    public currency: string,
    public amountInCents: number,
    public balanceChangeInCents: number,
    public description: string | null,
    public memo: string | null,
    public actualBalances: CurrencyAmounts,
    public budgetBalances: CurrencyAmounts,
    public sourceTransactionId: string | null,
    public associatedAccounts: string | null,
    public sourceTransaction: A.Model.entities.SourceTransaction | null
  ) {}

  static fromJournalEntryAccount(
    jea: A.Model.entities.JournalEntryAccount,
    ae: A.Model.entities.AccountEntry | null
  ): AccountEntry {
    const je = jea.journalEntry
    const a = jea.account
    const st = je.sourceTransaction
    const {id, date} = je
    const {creditOrDebit, currency, amountInCents} = jea
    const description = st?.description ?? null
    const {memo, budgetOrActual} = je
    const sourceTransactionId = st?.transactionId ?? null
    const balanceChangeInCents =
      creditOrDebit === a.actualCreditOrDebit ? amountInCents : -amountInCents
    const associatedAccounts = je.journalEntryAccounts.entitiesArray
      .filter((ojea) => ojea.account !== a)
      .map((ojea) => ojea.account.name)
      .join(", ")
    const entryId = a.id
    const actualBalances =
      ae == null
        ? []
        : ae.runningBalances.byCurrency.entitiesArray.map((b) => {
            const {currency, actualBalanceInCents} = b
            return new CurrencyAmount(currency, actualBalanceInCents)
          })
    const budgetBalances =
      ae == null
        ? []
        : ae.runningBalances.byCurrency.entitiesArray.map((b) => {
            const {currency, budgetBalanceInCents} = b
            return new CurrencyAmount(currency, budgetBalanceInCents)
          })

    return new AccountEntry(
      je,
      budgetOrActual,
      entryId,
      date,
      creditOrDebit,
      currency,
      amountInCents,
      balanceChangeInCents,
      description,
      memo,
      actualBalances,
      budgetBalances,
      sourceTransactionId,
      associatedAccounts,
      st
    )
  }
}

export class AccountEntries {
  constructor(entries: Array<AccountEntry>, sort: AccountEntriesSortKey) {
    this._entriesProp = entries
    this.sort = new LiveValue(sort)
    this.entries = new LiveValue(() =>
      AccountEntries.sortEntries(this._entriesProp, this.sort.value)
    )
  }

  open = new LiveValue<boolean>(false)
  sort: LiveValue<AccountEntriesSortKey>
  entries: LiveValue<Array<AccountEntry>>

  _entriesProp: Array<AccountEntry>

  static sortEntries(
    entries: Array<AccountEntry>,
    sort: AccountEntriesSortKey
  ): Array<AccountEntry> {
    const ret = entries.slice()
    const {property, direction} = sort
    switch (property) {
      case "original":
        break
      case "id":
        A.Utils.sortBy(ret, (a) => a.id, direction === "asc")
        break
      case "date":
        A.Utils.sortBy(ret, (a) => [a.date, a.id], direction === "asc")
        break
      case "creditOrDebit":
        A.Utils.sortBy(ret, (a) => [a.creditOrDebit, a.id], direction === "asc")
        break
      case "currency":
        A.Utils.sortBy(ret, (a) => [a.currency, a.id], direction === "asc")
        break
      case "amount":
        A.Utils.sortBy(
          ret,
          (a) => [a.balanceChangeInCents, a.id],
          direction === "asc"
        )
        break
      case "description":
        A.Utils.sortBy(ret, (a) => [a.description, a.id], direction === "asc")
        break
      case "memo":
        A.Utils.sortBy(ret, (a) => [a.memo, a.id], direction === "asc")
        break
      case "sourceTransactionId":
        A.Utils.sortBy(
          ret,
          (a) => [a.sourceTransactionId, a.id],
          direction === "asc"
        )
        break
      case "associatedAccounts":
        A.Utils.sortBy(
          ret,
          (a) => [a.associatedAccounts, a.id],
          direction === "asc"
        )
        break
      default:
        const unexpected: never = property
        break
    }
    return ret
  }
}

export class AccountEntriesSortKey {
  constructor(
    public property: AccountEntriesSortProperty,
    public direction: SortDirection
  ) {}
}

export type AccountEntriesSortProperty =
  | "original"
  | "id"
  | "date"
  | "creditOrDebit"
  | "currency"
  | "amount"
  | "description"
  | "memo"
  | "sourceTransactionId"
  | "associatedAccounts"

function subtractCurrencyAmounts(
  c1: CurrencyAmounts,
  c2: CurrencyAmounts
): CurrencyAmounts {
  type CurrencyAmountPair = {
    c1: CurrencyAmount | null
    c2: CurrencyAmount | null
  }

  const currencyAmountPairByCurrency = new Map<string, CurrencyAmountPair>()

  function getOrCreateCurrencyAmountPair(currency: string): CurrencyAmountPair {
    const existing = currencyAmountPairByCurrency.get(currency)
    if (existing != null) {
      return existing
    }
    const created = {c1: null, c2: null}
    currencyAmountPairByCurrency.set(currency, created)
    return created
  }

  for (const c of c1) {
    getOrCreateCurrencyAmountPair(c.currency).c1 = c
  }
  for (const c of c2) {
    getOrCreateCurrencyAmountPair(c.currency).c2 = c
  }

  const ret: CurrencyAmounts = []
  for (const [currency, amounts] of currencyAmountPairByCurrency.entries()) {
    const amount1 = amounts.c1?.amountInCents ?? 0
    const amount2 = amounts.c2?.amountInCents ?? 0
    const amountInCents = amount1 - amount2
    ret.push({currency, amountInCents})
  }
  return ret
}
