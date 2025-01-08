import {A, M} from "../index.js"
import * as Plaid from "plaid"
import fs from "node:fs"
import Path from "node:path"
import later from "@breejs/later"

export class SourceTransactionLoader {
  constructor(
    public props: {
      model: M.Model
      plaidConfig: M.entities.PlaidConfig
      sourceTransactionPaths: M.SourceTransactionPaths
    }
  ) {}

  loadNewPlaidTransactions(
    loadSpec: LoadSpec
  ): Array<A.Model.entities.SourceTransaction> {
    // Load all transactions from the adjacent years, just in case
    // there are any that were not downloaded during the exact year
    const {startDate, endDate} = loadSpec
    const startYear = loadSpec.startDate.getFullYear() - 1
    const endYear = loadSpec.endDate.getFullYear() + 1

    const run = (): Array<A.Model.entities.SourceTransaction> => {
      const ret: Array<A.Model.entities.SourceTransaction> = []
      const plaidItems = this.props.plaidConfig.plaidItems.entitiesArray
      for (const plaidItemConfig of plaidItems) {
        const newItemTransactions =
          loadNewPlaidItemTransactions(plaidItemConfig)
        ret.push(...newItemTransactions)
      }
      return ret
    }

    const loadNewPlaidItemTransactions = (
      plaidItemConfig: M.entities.PlaidItemConfig
    ): Array<A.Model.entities.SourceTransaction> => {
      const ret: Array<A.Model.entities.SourceTransaction> = []
      const dir = Path.join(
        this.props.sourceTransactionPaths.getPlaidItemDownloadedTransactionsDir(
          plaidItemConfig.name
        ),
        "byEndingYear"
      )
      fs.mkdirSync(dir, {recursive: true})
      for (const dirent of fs.readdirSync(dir, {withFileTypes: true})) {
        if (dirent.isDirectory()) {
          const year = parseInt(dirent.name)
          if (!isNaN(year) && year >= startYear && year <= endYear) {
            const yearDir = Path.join(dir, dirent.name)
            for (const dirent of fs.readdirSync(yearDir, {
              withFileTypes: true,
            })) {
              if (dirent.isFile()) {
                const filename = Path.join(yearDir, dirent.name)
                const newItemTransactions =
                  loadNewPlaidItemTransactionsFromFile(
                    plaidItemConfig,
                    filename
                  )
                ret.push(...newItemTransactions)
              }
            }
          }
        }
      }
      return ret
    }

    const loadNewPlaidItemTransactionsFromFile = (
      plaidItemConfig: M.entities.PlaidItemConfig,
      file: string
    ): Array<A.Model.entities.SourceTransaction> => {
      const ret: Array<A.Model.entities.SourceTransaction> = []
      const plaidResponse: Plaid.TransactionsGetResponse =
        A.Utils.readJsonFile(file)
      for (const transaction of plaidResponse.transactions) {
        const {
          account_id,
          amount,
          iso_currency_code,
          unofficial_currency_code,
          check_number,
          date,
          name,
          original_description,
          transaction_id,
          authorized_date,
          datetime,
          transaction_code,
          category,
          pending,
        } = transaction
        const transactionId = `plaid-${transaction_id}`
        const parsedDate = new Date(Date.parse(date))
        if (
          parsedDate >= startDate &&
          parsedDate < endDate &&
          !pending &&
          !this.props.model.entities.SourceTransaction.byTransactionId.hasKey(
            transactionId
          )
        ) {
          const suggestedCategory =
            category != null && category.length > 0 ? category.join("/") : null
          const plaidAccountConfig =
            this.props.model.entities.PlaidAccountConfig.byPlaidAccountId.get(
              account_id
            )
          const accountName = plaidAccountConfig.name
          const plaidTransaction =
            this.props.model.entities.PlaidTransaction.add({
              transactionId,
              accountName,
              date: A.Utils.dateToYYYYMMDD(parsedDate),
              amountInCents: Math.floor(amount * 100 + 0.5),
              currency: iso_currency_code || unofficial_currency_code || "USD",
              plaidAccountId: account_id,
              name,
              description: original_description || name,
              suggestedCategory,
              plaidTransaction: transaction,
            })
          ret.push(plaidTransaction)
        }
      }
      return ret
    }

    return run()
  }

  loadNewScheduledSourceTransactions(
    loadSpec: LoadSpec,
    scheduledSourceTransactions: Array<A.JournalConfig.ScheduledSourceTransaction>
  ): Array<A.Model.entities.SourceTransaction> {
    const ret: Array<A.Model.entities.SourceTransaction> = []
    const {startDate, endDate} = loadSpec
    for (const entry of scheduledSourceTransactions) {
      const {schedule, name, description} = entry
      const sched = later.parse.text(schedule)
      const {exceptions, error} = sched
      if (error >= 0) {
        throw new Error(
          `Invalid schedule for entry ${entry.id}: "${schedule}", JSON.stringify({exceptions, error})`
        )
      }
      const laterSchedule = later.schedule(sched)
      // Use today as the endDate
      const today = new Date()
      const instances = laterSchedule.next(366, startDate, today)
      if (Array.isArray(instances)) {
        for (let i = 0; i < instances.length; i++) {
          const instance = instances[i]
          const entryDate = A.DateUtils.toYYYY_MM_DD(instance)
          const transactionId = `scheduled-${entry.id}-${entryDate}`
          if (
            !this.props.model.entities.SourceTransaction.byTransactionId.hasKey(
              transactionId
            )
          ) {
            const transaction =
              this.props.model.entities.ScheduledTransaction.add({
                transactionId,
                accountName: entry.account,
                date: entryDate,
                amountInCents: entry.amountInCents,
                currency: entry.currency ?? "USD",
                name,
                description,
              })
            ret.push(transaction)
          }
        }
      }
    }
    return ret
  }
}

export interface LoadSpec {
  startDate: Date
  endDate: Date
}
