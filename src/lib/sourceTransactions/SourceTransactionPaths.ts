import {A, M} from "../index.js"
import Path from "node:path"

export class SourceTransactionPaths {
  constructor(public props: {}) {}

  get downloadedTransactionsBaseDir(): string {
    return Path.join(
      Path.dirname(A.Utils.getPackageDirectory()),
      "data",
      "downloadedTransactions"
    )
  }

  getPlaidItemDownloadedTransactionsDir(itemName: string): string {
    return Path.join(this.downloadedTransactionsBaseDir, "plaidItems", itemName)
  }
}
