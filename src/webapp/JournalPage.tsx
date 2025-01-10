import {A, M} from "../lib/index.js"
import * as R from "react"
import * as RR from "react-router"
import * as RRD from "react-router-dom"
import * as V from "./views.js"
import * as I24S from "@heroicons/react/24/solid"
import * as VM from "./ViewModel.js"
import {LiveValue, useLiveValue} from "live-value"

export const JournalPage = () => {
  const api = V.useApi()
  const [model, setModel] = R.useState<M.Model | null>(null)
  const [journal, setJournal] = R.useState<VM.Journal | null>(null)

  // Get any URL parameters
  const params = RR.useParams()
  const [searchParams] = RRD.useSearchParams()

  R.useEffect(() => {
    ;(async () => {
      // Get the date to limit actual and budget entries by
      const endDateStr = searchParams.get("endDate")
      const endDate =
        endDateStr == null
          ? null
          : endDateStr === "today"
            ? new Date()
            : new Date(Date.parse(endDateStr))

      // Load the model from the server
      const model = await loadModelFromServer(api, endDate)
      const count = model.entities.JournalEntry.all.count
      setModel(model)
      const journal = VM.Journal.fromModel(model)
      setJournal(journal)

      if (params.accountName != null) {
        const accountView = journal.openAccountWithName(params.accountName)

        // See if entries should also be opened
        const showEntries = searchParams.get("showEntries")
        if (showEntries != null) {
          switch (showEntries) {
            case "entries":
              accountView.entries.open.value = true
              break
            case "all":
              accountView.allEntries.open.value = true
              break
            case "budgetAndActual":
              accountView.budgetAndActualEntries.open.value = true
              break
          }
        }
      }
    })()
  }, [])

  return (
    <div>
      <div className="font-sans">This is the journal page</div>
      {journal && <JournalView journal={journal} />}
    </div>
  )
}

async function loadModelFromServer(
  api: M.IApi,
  endDate: Date | null
): Promise<M.Model> {
  // Load the model from the server
  const result = await api.model.entity.list({}).response
  const model = A.AppModel.createModel()
  for (const entity of result.entities) {
    model.entityFromJson(entity)
  }
  A.AppModel.postProcessModel({model, endDate})
  return model
}

const JournalView = ({journal}: {journal: VM.Journal}) => {
  return <AccountsView accounts={journal.accounts} />
}

const AccountsView = ({accounts}: {accounts: VM.Accounts}) => {
  const accountsList = useLiveValue(accounts.accounts)
  return (
    accountsList.length > 0 && (
      <div className="border-t-2 border-b-2 border-top-width-1 ml-5">
        <AccountsHeaderView sortLV={accounts.sort} />
        {accountsList.map((a) => (
          <AccountView key={a.id} account={a} />
        ))}
      </div>
    )
  )
}

const AccountsHeaderView = ({
  sortLV,
}: {
  sortLV: LiveValue<VM.AccountsSortKey>
}) => {
  const sort = useLiveValue(sortLV)
  const onSortChange = (newSort: VM.AccountsSortKey) => {
    sortLV.value = newSort
  }

  return (
    <div className="flex flex-row flex-nowrap items-baseline">
      <span style={{flexBasis: "20px"}}></span>
      <span style={{flexBasis: "300px"}}>
        <span>Account Name</span>
        <AccountsSortSelect
          sort={sort}
          property="name"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <span>Actual Balance</span>
        <AccountsSortSelect
          sort={sort}
          property="actualBalance"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span style={{flexBasis: "10rem"}}></span>
      <span style={{flexBasis: "10rem"}}>
        <span>Budget Balance</span>
        <AccountsSortSelect
          sort={sort}
          property="budgetBalance"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span style={{flexBasis: "10rem"}}></span>
      <span style={{flexBasis: "10rem"}}>
        <span>Overbudget</span>
        <AccountsSortSelect
          sort={sort}
          property="overbudget"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span style={{flexBasis: "10rem"}}></span>
    </div>
  )
}

const AccountView = ({account}: {account: VM.Account}) => {
  const {id, name, creditOrDebit, actualBalances} = account
  const open = useLiveValue(account.open)

  return (
    <div>
      <AccountHeaderView account={account} />
      {open && <AccountDetailView account={account} />}
    </div>
  )
}

const AccountDetailView = ({account}: {account: VM.Account}) => {
  return (
    <div>
      <AccountEntriesView
        account={account}
        entries={account.allEntries}
        title="in this account and all its descendants"
      />
      <AccountBudgetAndActualEntriesView
        account={account}
        entries={account.budgetAndActualEntries}
        title="of budget and actuals in this account and its descendants"
      />
      <AccountEntriesView
        account={account}
        entries={account.entries}
        title="specific to this account"
      />
      <AccountsView accounts={account.accounts} />
    </div>
  )
}

const AccountHeaderView = ({account}: {account: VM.Account}) => {
  const {id, name, description, actualBalances, budgetBalances, overbudget} =
    account
  const open = useLiveValue(account.open)
  const onOpenChange = (val: boolean) => {
    account.open.value = val
  }

  return (
    <div className="flex flex-row flex-nowrap items-baseline">
      <span style={{flexBasis: "20px"}}>
        <OpenClose open={open} onChange={onOpenChange} />
      </span>
      <span className="font-semibold text-lg" style={{flexBasis: "300px"}}>
        {name}
      </span>
      <span style={{flexBasis: "10rem"}}>
        <USDCurrencyAmountView amounts={actualBalances} />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <OtherCurrencyAmountsView amounts={actualBalances} />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <USDCurrencyAmountView amounts={budgetBalances} />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <OtherCurrencyAmountsView amounts={budgetBalances} />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <USDCurrencyAmountView amounts={overbudget} />
      </span>
      <span style={{flexBasis: "10rem"}}>
        <OtherCurrencyAmountsView amounts={overbudget} />
      </span>
      <span style={{flexBasis: "30rem"}}>
        <span className="italic text-xs">{description}</span>
      </span>
    </div>
  )
}

const USDCurrencyAmountView = ({amounts}: {amounts: VM.CurrencyAmounts}) => {
  const usdCurrency: VM.CurrencyAmount =
    amounts.find((a) => a.currency === "USD") ?? VM.CurrencyAmount.defaultValue
  const {currency, amountInCents} = usdCurrency
  const currencyStr = A.Utils.toCurrency(amountInCents, currency)
  const color = currencyColor(amountInCents)

  return (
    <span key={currency} className={`inline-block w-full text-right ${color}`}>
      {currencyStr}
    </span>
  )
}

const OtherCurrencyAmountsView = ({amounts}: {amounts: VM.CurrencyAmounts}) => {
  const otherCurrencies = A.Utils.sortBy(
    amounts.filter((a) => a.currency !== "USD"),
    (e) => e.currency
  )

  if (otherCurrencies.length == 0) {
    return null
  }

  return (
    <div className="ml-4">
      {otherCurrencies.map((a) => {
        const {currency, amountInCents} = a
        const currencyStr = A.Utils.toCurrency(amountInCents, currency)
        const classes = ["text-xs", "mr-2", currencyColor(amountInCents)]
        return (
          <span key={currency} className={classes.join(" ")}>
            {currencyStr}
          </span>
        )
      })}
    </div>
  )
}

const AccountEntriesView = ({
  account,
  entries,
  title,
}: {
  account: VM.Account
  entries: VM.AccountEntries
  title: string
}) => {
  const entriesList = useLiveValue(entries.entries)
  const entryOrEntries = entriesList.length === 1 ? "entry" : "entries"
  const open = useLiveValue(entries.open)
  const onOpenChange = (val: boolean) => {
    entries.open.value = val
  }

  return (
    <div className="ml-20">
      <div className="flex flex-row flex-nowrap items-baseline">
        <span style={{flexBasis: "20px"}}>
          <OpenClose open={open} onChange={onOpenChange} />
        </span>
        <span>
          {entriesList.length} {entryOrEntries} {title}
        </span>
      </div>
      {open && <AccountEntriesListView account={account} entries={entries} />}
    </div>
  )
}

const AccountEntriesListView = ({
  account,
  entries,
}: {
  account: VM.Account
  entries: VM.AccountEntries
}) => {
  const entriesList = useLiveValue(entries.entries)

  return (
    <div>
      <AccountEntriesListHeaderView sortLV={entries.sort} />
      {entriesList.map((e) => (
        <AccountEntryView key={e.id} account={account} entry={e} />
      ))}
    </div>
  )
}

const AccountEntryView = ({
  account,
  entry,
}: {
  account: VM.Account
  entry: VM.AccountEntry
}) => {
  const open = useLiveValue(entry.open)
  const onOpenChange = (val: boolean) => {
    entry.open.value = val
  }

  const {
    date,
    balanceChangeInCents,
    currency,
    description,
    memo,
    creditOrDebit,
    sourceTransactionId,
    associatedAccounts,
  } = entry
  return (
    <>
      <div className="flex flex-row flex-nowrap items-baseline">
        <span style={{flexBasis: "20px"}}>
          <OpenClose open={open} onChange={onOpenChange} />
        </span>
        <span style={{flexBasis: "6rem"}}>{date}</span>
        <span
          className={`${currencyColor(balanceChangeInCents)} text-right`}
          style={{flexBasis: "10rem"}}
        >
          {A.Utils.toCurrency(balanceChangeInCents, currency)}
        </span>
        <span className="text-xs ml-1" style={{flexBasis: "25rem"}}>
          {description}
        </span>
        <span className="italic text-xs ml-1" style={{flexBasis: "20rem"}}>
          {memo}
        </span>
        <span
          className="text-xs ml-1 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{flexBasis: "12rem"}}
        >
          {associatedAccounts}
        </span>
        <span
          className="text-xs ml-1 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{flexBasis: "8rem"}}
        >
          {sourceTransactionId}
        </span>
      </div>
      {open && <AccountEntryDetailView entry={entry} />}
    </>
  )
}

const AccountEntriesListHeaderView = ({
  sortLV,
}: {
  sortLV: LiveValue<VM.AccountEntriesSortKey>
}) => {
  const sort = useLiveValue(sortLV)
  const onSortChange = (newSort: VM.AccountEntriesSortKey) => {
    sortLV.value = newSort
  }

  return (
    <div className="border-b-2 flex flex-row flex-nowrap items-baseline">
      <span style={{flexBasis: "20px"}}></span>
      <span style={{flexBasis: "6rem"}}>
        Date
        <AccountEntriesSortSelect
          sort={sort}
          property="date"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span style={{flexBasis: "10rem"}}>
        Amount
        <AccountEntriesSortSelect
          sort={sort}
          property="amount"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span className="ml-1" style={{flexBasis: "25rem"}}>
        Original Description
        <AccountEntriesSortSelect
          sort={sort}
          property="description"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span className="ml-1" style={{flexBasis: "20rem"}}>
        Our Notes
        <AccountEntriesSortSelect
          sort={sort}
          property="memo"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span className="ml-1" style={{flexBasis: "12rem"}}>
        Associated Accounts
        <AccountEntriesSortSelect
          sort={sort}
          property="associatedAccounts"
          onChange={(s) => onSortChange(s)}
        />
      </span>
      <span className="ml-1" style={{flexBasis: "8rem"}}>
        Transction Id
        <AccountEntriesSortSelect
          sort={sort}
          property="sourceTransactionId"
          onChange={(s) => onSortChange(s)}
        />
      </span>
    </div>
  )
}

const AccountEntryDetailView = ({entry}: {entry: VM.AccountEntry}) => {
  const open = useLiveValue(entry.open)
  const onOpenChange = (val: boolean) => {
    entry.open.value = val
  }

  const {journalEntry, sourceTransaction} = entry

  return (
    <div className="ml-10">
      <JournalEntryView entry={entry.journalEntry} />
      {sourceTransaction && (
        <div className="mt-2 mb-2">
          <SourceTransactionView
            entry={entry}
            sourceTransaction={sourceTransaction}
          />
        </div>
      )}
    </div>
  )
}

const JournalEntryView = ({entry}: {entry: A.Model.entities.JournalEntry}) => {
  const {id, date, memo} = entry
  return (
    <div>
      <span>
        Journal Entry {id}, {date}
      </span>
      {memo != null && memo != "" && (
        <div className="ml-5">
          Memo: <span className="italic">{memo}</span>
        </div>
      )}
      <div className="ml-10">
        {entry.journalEntryAccounts.entitiesArray.map((jea) => (
          <JournalEntryAccountView entryAccount={jea} />
        ))}
      </div>
    </div>
  )
}

const JournalEntryAccountView = ({
  entryAccount,
}: {
  entryAccount: A.Model.entities.JournalEntryAccount
}) => {
  const {amountInCents, currency, creditOrDebit, account} = entryAccount
  return (
    <div>
      {creditOrDebit === "credit" ? (
        <span>
          Credit {A.Utils.toCurrency(amountInCents, currency)} to{" "}
          <span className="font-bold">{account.name}</span>
        </span>
      ) : (
        <span>
          Debit {A.Utils.toCurrency(amountInCents, currency)} from{" "}
          <span className="font-bold">{account.name}</span>
        </span>
      )}
    </div>
  )
}

const SourceTransactionView = ({
  entry,
  sourceTransaction,
}: {
  entry: VM.AccountEntry
  sourceTransaction: A.Model.entities.SourceTransaction
}) => {
  const {transactionId} = sourceTransaction
  const open = useLiveValue(entry.sourceTransactionOpen)
  const onOpenChange = (val: boolean) => {
    entry.sourceTransactionOpen.value = val
  }

  return (
    <>
      <div className="flex flex-row flex-nowrap items-baseline">
        <span style={{flexBasis: "20px"}}>
          <OpenClose open={open} onChange={onOpenChange} />
        </span>
        <span>Source Transaction {transactionId}</span>
      </div>
      {open && (
        <SourceTransactionDetailView sourceTransaction={sourceTransaction} />
      )}
    </>
  )
}

const SourceTransactionDetailView = ({
  sourceTransaction,
}: {
  sourceTransaction: A.Model.entities.SourceTransaction
}) => {
  const json = JSON.stringify(sourceTransaction.toJSON(), null, 2)
  return (
    <div className="ml-5 text-xs">
      <pre>{json}</pre>
    </div>
  )
}

export function currencyColor(amount: number) {
  return amount >= 0 ? "text-green-600" : "text-red-600"
}

const OpenClose = ({
  open,
  onChange,
}: {
  open: boolean
  onChange: (val: boolean) => void
}) => {
  const onClick = () => {
    onChange(!open)
  }
  return (
    <div onClick={onClick}>
      {open ? (
        <I24S.ChevronDownIcon className="size-4" />
      ) : (
        <I24S.ChevronRightIcon className="size-4" />
      )}
    </div>
  )
}

const AccountsSortSelect = ({
  sort,
  property,
  onChange,
}: {
  sort: VM.AccountsSortKey
  property: VM.AccountsSortProperty
  onChange: (sort: VM.AccountsSortKey) => void
}) => {
  const selectedColor = "text-green-600"
  const upColor =
    sort.property === property && sort.direction === "asc" ? selectedColor : ""
  const downColor =
    sort.property === property && sort.direction === "desc" ? selectedColor : ""

  const onClick = (direction: VM.SortDirection) => {
    if (sort.property === property && sort.direction === direction) {
      onChange({property: "original", direction: "asc"})
    } else {
      onChange({property, direction})
    }
  }

  return (
    <span className="inline-block">
      <I24S.ArrowUpIcon
        className={`inline-block size-4 ${upColor}`}
        onClick={() => onClick("asc")}
      />
      <I24S.ArrowDownIcon
        className={`inline-block size-4 ${downColor}`}
        onClick={() => onClick("desc")}
      />
    </span>
  )
}

const AccountEntriesSortSelect = ({
  sort,
  property,
  onChange,
}: {
  sort: VM.AccountEntriesSortKey
  property: VM.AccountEntriesSortProperty
  onChange: (sort: VM.AccountEntriesSortKey) => void
}) => {
  const selectedColor = "text-green-600"
  const upColor =
    sort.property === property && sort.direction === "asc" ? selectedColor : ""
  const downColor =
    sort.property === property && sort.direction === "desc" ? selectedColor : ""

  const onClick = (direction: VM.SortDirection) => {
    if (sort.property === property && sort.direction === direction) {
      onChange({property: "original", direction: "asc"})
    } else {
      onChange({property, direction})
    }
  }

  return (
    <span className="inline-block">
      <I24S.ArrowUpIcon
        className={`inline-block size-4 ${upColor}`}
        onClick={() => onClick("asc")}
      />
      <I24S.ArrowDownIcon
        className={`inline-block size-4 ${downColor}`}
        onClick={() => onClick("desc")}
      />
    </span>
  )
}

const AccountBudgetAndActualEntriesView = ({
  account,
  entries,
  title,
}: {
  account: VM.Account
  entries: VM.AccountEntries
  title: string
}) => {
  const entriesList = useLiveValue(entries.entries)
  const entryOrEntries = entriesList.length === 1 ? "entry" : "entries"
  const open = useLiveValue(entries.open)
  const onOpenChange = (val: boolean) => {
    entries.open.value = val
  }

  return (
    <div className="ml-20">
      <div className="flex flex-row flex-nowrap items-baseline">
        <span style={{flexBasis: "20px"}}>
          <OpenClose open={open} onChange={onOpenChange} />
        </span>
        <span>
          {entriesList.length} {entryOrEntries} {title}
        </span>
      </div>
      {open && (
        <AccountBudgetAndActualEntriesListView
          account={account}
          entries={entries}
        />
      )}
    </div>
  )
}

const AccountBudgetAndActualEntriesListView = ({
  account,
  entries,
}: {
  account: VM.Account
  entries: VM.AccountEntries
}) => {
  const entriesList = useLiveValue(entries.entries)

  return (
    <div>
      <AccountBudgetAndActualEntriesListHeaderView sortLV={entries.sort} />
      {entriesList.map((e) => (
        <AccountBudgetOrActualEntryView
          key={e.id}
          account={account}
          entry={e}
        />
      ))}
    </div>
  )
}

const AccountBudgetAndActualEntriesListHeaderView = ({
  sortLV,
}: {
  sortLV: LiveValue<VM.AccountEntriesSortKey>
}) => {
  const sort = useLiveValue(sortLV)
  const onSortChange = (newSort: VM.AccountEntriesSortKey) => {
    sortLV.value = newSort
  }

  return (
    <div className="border-b-2 flex flex-row flex-nowrap items-baseline">
      <span style={{flexBasis: "20px"}}></span>
      <span style={{flexBasis: "6rem"}}>Date</span>
      <span style={{flexBasis: "10rem"}}>Budget Amount</span>
      <span style={{flexBasis: "10rem"}}>Actual Amount</span>
      <span style={{flexBasis: "10rem"}}>Budget Balance</span>
      <span style={{flexBasis: "10rem"}}>Actual Balance</span>
      <span className="ml-1" style={{flexBasis: "25rem"}}>
        Original Description
      </span>
      <span className="ml-1" style={{flexBasis: "20rem"}}>
        Our Notes
      </span>
      <span className="ml-1" style={{flexBasis: "12rem"}}>
        Associated Accounts
      </span>
      <span className="ml-1" style={{flexBasis: "8rem"}}>
        Transction Id
      </span>
    </div>
  )
}

const AccountBudgetOrActualEntryView = ({
  account,
  entry,
}: {
  account: VM.Account
  entry: VM.AccountEntry
}) => {
  const open = useLiveValue(entry.open)
  const onOpenChange = (val: boolean) => {
    entry.open.value = val
  }

  const {
    date,
    balanceChangeInCents,
    currency,
    description,
    memo,
    creditOrDebit,
    sourceTransactionId,
    associatedAccounts,
    actualBalances,
    budgetBalances,
  } = entry

  const showBalanceChange = () => (
    <span className={`${currencyColor(balanceChangeInCents)} text-right`}>
      {A.Utils.toCurrency(balanceChangeInCents, currency)}
    </span>
  )

  return (
    <>
      <div className="flex flex-row flex-nowrap items-baseline">
        <span style={{flexBasis: "20px"}}>
          <OpenClose open={open} onChange={onOpenChange} />
        </span>
        <span style={{flexBasis: "6rem"}}>{date}</span>
        <span style={{flexBasis: "10rem"}}>
          {entry.budgetOrActual === "budget" && showBalanceChange()}
        </span>
        <span style={{flexBasis: "10rem"}}>
          {entry.budgetOrActual === "actual" && showBalanceChange()}
        </span>
        <span style={{flexBasis: "10rem"}}>
          <USDCurrencyAmountView amounts={budgetBalances} />
        </span>
        <span style={{flexBasis: "10rem"}}>
          <USDCurrencyAmountView amounts={actualBalances} />
        </span>
        <span className="text-xs ml-1" style={{flexBasis: "25rem"}}>
          {description}
        </span>
        <span className="italic text-xs ml-1" style={{flexBasis: "20rem"}}>
          {memo}
        </span>
        <span
          className="text-xs ml-1 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{flexBasis: "12rem"}}
        >
          {associatedAccounts}
        </span>
        <span
          className="text-xs ml-1 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{flexBasis: "8rem"}}
        >
          {sourceTransactionId}
        </span>
      </div>
      {open && <AccountEntryDetailView entry={entry} />}
    </>
  )
}
