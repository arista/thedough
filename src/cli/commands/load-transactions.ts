import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class LoadTransactions extends OC.Command {
  static description = "Loads all of the downloaded transactions"

  static args = {}
  static flags = {
    "start-date": OC.Flags.string({
      char: "s",
      description: `The Date to start loading from`,
      required: false,
    }),
    "end-date": OC.Flags.string({
      char: "e",
      description: `The Date to end loading from`,
      required: false,
    }),
    csv: OC.Flags.string({
      description: `The CSV file to write the transactions to`,
      required: false,
    }),
  }
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(LoadTransactions)

    const nowYear = new Date().getFullYear()
    const defaultStartDate = new Date(Date.parse(`${nowYear}-01-01`))
    const defaultEndDate = new Date(Date.parse(`${nowYear + 1}-01-01`))

    const startDateStr = flags["start-date"]
    const endDateStr = flags["start-date"]
    const startDate =
      startDateStr == null
        ? defaultStartDate
        : new Date(Date.parse(startDateStr))
    const endDate =
      endDateStr == null ? defaultEndDate : new Date(Date.parse(endDateStr))

    return await M.App.withApp({}, async (app) => {
      const transactions = await app.loadTransactions({
        startDate,
        endDate,
      })
      const csv = flags["csv"]
      if (csv != null) {
        await A.SourceTransactions.sourceTransactionsToCsv({
          transactions,
          filename: csv,
        })
      }
      return transactions
    })
  }
}
