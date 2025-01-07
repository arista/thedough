import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class GetAccounts extends OC.Command {
  static description =
    "Returns the account information for each of the plaid items"

  static args = {}
  static flags = {}
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(GetAccounts)

    return await M.App.withApp({}, async (app) => {
      return app.getAccounts()
    })
  }
}
