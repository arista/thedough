import {A, M} from "../index.js"
import Path from "node:path"

export class TransactionDownloader {
  constructor(
    public props: {
      plaidConfig: M.entities.PlaidConfig
      plaidApi: M.PlaidApi
      sourceTransactionPaths: M.SourceTransactionPaths
    }
  ) {}

  async downloadTransactions() {
    const plaidItems = this.props.plaidConfig.plaidItems.entitiesArray
    const plaidItemPromises = plaidItems.map(async (plaidItemConfig) => {
      const transactionsDir =
        this.props.sourceTransactionPaths.getPlaidItemDownloadedTransactionsDir(
          plaidItemConfig.name
        )
      const {plaidApi} = this.props
      const downloader = new M.PlaidItemTransactionDownloader({
        plaidItemConfig,
        transactionsDir,
        plaidApi,
      })
      while (true) {
        const {complete} = await downloader.runNextRequest()
        if (complete) {
          break
        }
      }
    })
    await Promise.all(plaidItemPromises)
  }
}
