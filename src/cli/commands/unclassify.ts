import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class Unclassify extends OC.Command {
  static description =
    "Unclassify a previously-classified transaction, returning it to the forReview file"

  static args = {
    "source-transaction-id": OC.Args.string({
      description: `The id of the source transaction to unclassify`,
      required: true,
    }),
  }
  static flags = {
    "config-name": OC.Flags.string({
      char: "c",
      description: `The config name to use (defaults to the current year, e.g., "2024")`,
      required: false,
    }),
  }
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Unclassify)
    const configNameArg = flags["config-name"]
    const configName = configNameArg ?? A.DateUtils.currentYearStr()
    const sourceTransactionId = args["source-transaction-id"]

    try {
      await M.App.withApp({}, async (app) => {
        return await app.unclassify({
          configName,
          sourceTransactionId,
        })
      })
    } catch (e) {
      console.trace(e)
      throw e
    }
  }
}
