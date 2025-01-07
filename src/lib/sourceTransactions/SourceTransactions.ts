import {A, M} from "../index.js"
import {stringify} from "csv-stringify/sync"
import fs from "node:fs"

export function sourceTransactionsToCsv({
  transactions,
  filename,
}: {
  transactions: Array<M.entities.SourceTransaction>
  filename: string
}) {
  const csvRecords = transactions.map((t) => {
    const {
      date,
      accountName,
      amountInCents,
      name,
      description,
      currency,
      checkNumber,
      transactionId,
    } = t
    return {
      date,
      accountName,
      amount: amountInCents / 100.0,
      name,
      description,
      currency,
      checkNumber,
      transactionId,
    }
  })
  const csvString = stringify(csvRecords, {
    header: true,
    columns: [
      {key: "date"},
      {key: "accountName"},
      {key: "amount"},
      {key: "name"},
      {key: "description"},
      {key: "currency"},
      {key: "checkNumbe"},
      {key: "transactionId"},
    ],
  })
  fs.writeFileSync(filename, csvString)
}
