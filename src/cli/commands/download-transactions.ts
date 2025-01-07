import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class DownloadTransactions extends OC.Command {
  static description = "Downloads transactions from various sources"

  static args = {}
  static flags = {}
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(DownloadTransactions)

    await M.App.withApp({}, async (app) => {
      return await app.downloadTransactions()
    })
  }
}
