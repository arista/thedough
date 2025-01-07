import {A, M} from "../index.js"
import Path from "node:path"

export class SourceTransactionPaths {
  constructor(public props: {dataDirectory: string}) {}

  get downloadedTransactionsBaseDir(): string {
    const {dataDirectory} = this.props
    return Path.join(dataDirectory, "downloadedTransactions")
  }

  getPlaidItemDownloadedTransactionsDir(itemName: string): string {
    return Path.join(this.downloadedTransactionsBaseDir, "plaidItems", itemName)
  }
}
