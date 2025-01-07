import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class GetItems extends OC.Command {
  static description =
    "Returns the item information for each of the plaid items"

  static args = {}
  static flags = {}
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(GetItems)

    return await M.App.withApp({}, async (app) => {
      return app.getItems()
    })
  }
}
