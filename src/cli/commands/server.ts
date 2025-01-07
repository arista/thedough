import * as OC from "@oclif/core"
import {A, M} from "../../lib/index.js"

export default class Server extends OC.Command {
  static description = `Runs the server`

  static args = {}
  static flags = {
    port: OC.Flags.integer({
      char: "p",
      description: `Start the server on the specified port`,
      required: false,
      default: 3080,
    }),
    "config-name": OC.Flags.string({
      char: "c",
      description: `The config name to use (defaults to the current year, e.g., "2024")`,
      required: false,
    }),
  }
  static enableJsonFlag = true

  async run() {
    const {args, flags, argv} = await this.parse(Server)

    return await M.App.withApp({}, async (app) => {
      const port = flags["port"]
      const configNameArg = flags["config-name"]
      const configName = configNameArg ?? A.DateUtils.currentYearStr()

      const server = new M.Server({
        app,
        port,
        configName,
      })

      // Handle signals for clean shutdown
      const signals = ["SIGINT", "SIGQUIT", "SIGTERM"]
      for (const signal of signals) {
        process.on(signal, async () => {
          await server.shutdown()
          process.exit(0)
        })
      }

      await server.start()
      console.log(`Server listening on port ${port}`)
    })
  }
}
