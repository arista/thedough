import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class Test extends OC.Command {
  static description = "FIXME: test"

  static args = {}
  static flags = {}
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Test)

    await M.App.withApp({}, async (app) => {
      const plaidApi = await app.plaidApi
      const accountsResponse = await plaidApi.getAccounts({
        plaidItemName: "wellsFargoNathan",
      })
      console.log(JSON.stringify(accountsResponse, null, 2))

      const transactionsResponse = await plaidApi.getTransactions({
        plaidItemName: "wellsFargoNathan",
        startDate: "2024-01-01",
        endDate: "2024-02-01",
        offset: 0,
        count: 100,
      })
      console.log(JSON.stringify(transactionsResponse, null, 2))
    })
  }
}
