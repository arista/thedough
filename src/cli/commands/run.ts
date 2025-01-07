import * as OC from "@oclif/core"

import {A, M} from "../../lib/index.js"

export default class Run extends OC.Command {
  static description =
    "Run the main operation: load any new transactions, add journal entries, suggest classifications, and generate the forReview.csv file"

  static args = {}
  static flags = {
    "config-name": OC.Flags.string({
      char: "c",
      description: `The config name to use (defaults to the current year, e.g., "2024")`,
      required: false,
    }),
  }
  static enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Run)
    const configNameArg = flags["config-name"]
    const configName = configNameArg ?? A.DateUtils.currentYearStr()

    try {
      await M.App.withApp({}, async (app) => {
        return await app.run({
          configName,
        })
      })
    } catch (e) {
      console.trace(e)
      throw e
    }
  }
}
