import {A, M} from "../index.js"
import Path from "node:path"
import fs from "node:fs"
import columnify from "columnify"

// Write out the new list of unclassified transactions
export function writeUnclassifiedTransactions({
  filename,
  transactions,
  classificationRules,
}: {
  filename: string
  transactions: Array<M.entities.SourceTransaction>
  classificationRules: Array<M.ClassificationRule>
}): Array<A.Classification.UnclassifiedTransaction> {
  fs.mkdirSync(Path.dirname(filename), {recursive: true})
  const fd = fs.openSync(filename, "w")
  try {
    fs.writeSync(fd, `# Transactions that have not yet been classified\n`)
    fs.writeSync(
      fd,
      `# To classify a transaction, make sure the "Proposed Classification" is filled in\n`
    )
    fs.writeSync(
      fd,
      `# and place a "*" character at the beginning of the line\n`
    )
    fs.writeSync(fd, "\n")

    const data: Array<A.Classification.UnclassifiedTransaction> =
      transactions.map((t) => {
        const classifiedTransaction =
          A.ClassificationRule.applyClassificationRules(t, classificationRules)
        const suggestedClassification =
          classifiedTransaction != null
            ? A.Classification.stringifyClassification(classifiedTransaction)
            : ""

        return {
          approved: "",
          date: t.date,
          amount: `${A.Utils.toCurrency(t.amountInCents, t.currency)} (${t.currency})`,
          description: A.Utils.normalizeString(t.description),
          account: t.accountName,
          check: t.checkNumber ?? "",
          transactionId: t.transactionId,
          suggestedCategory: t.suggestedCategory ?? "",
          suggestedClassification,
        }
      })
    const sortedTransactions = data.sort((t1, t2) =>
      compareUnclassifiedTransactions(t1, t2)
    )
    const columned = columnify(sortedTransactions, {
      columnSplitter: "|",
      columns: [
        "approved",
        "date",
        "amount",
        "description",
        "account",
        "suggestedClassification",
        "check",
        "suggestedCategory",
        "transactionId",
      ],
      config: {
        approved: {minWidth: 1, maxWidth: 1, headingTransform: () => "*"},
        amount: {align: "right", headingTransform: () => "AMOUNT"},
        description: {
          minWidth: 50,
          maxWidth: 50,
        },
        suggestedCategory: {minWidth: 40, maxWidth: 40},
        suggestedClassification: {
          minWidth: 50,
        },
      },
    })
    fs.writeSync(fd, columned)
    return sortedTransactions
  } finally {
    fs.closeSync(fd)
  }
}

export function compareUnclassifiedTransactions(
  t1: A.Classification.UnclassifiedTransaction,
  t2: A.Classification.UnclassifiedTransaction
): number {
  const {suggestedClassification: c1, date: d1, transactionId: tid1} = t1
  const {suggestedClassification: c2, date: d2, transactionId: tid2} = t2

  if (c1 != "" && c2 == "") {
    return -1
  }
  if (c1 == "" && c2 != "") {
    return 1
  }
  const cmp1 = A.Utils.compareStrings(c1, c2)
  if (cmp1 != 0) {
    return cmp1
  }
  const cmp2 = A.Utils.compareStrings(d1, d2)
  if (cmp2 != 0) {
    return -cmp2
  }
  const cmp3 = A.Utils.compareStrings(tid1, tid2)
  if (cmp3 != 0) {
    return cmp3
  }
  return 0
}

// Read any newly-classified transactions
export function readNewlyClassifiedTransactions({
  filename,
  model,
}: {
  filename: string
  model: M.Model
}): Array<A.Classification.ClassifiedTransaction> {
  const lines = readUnclassifiedLines(filename)
  const ret: Array<A.Classification.ClassifiedTransaction> = []
  for (const line of lines) {
    if (
      line["*"].startsWith("*") &&
      line.TRANSACTIONID != "" &&
      line.SUGGESTEDCLASSIFICATION != ""
    ) {
      const suggestedClassification = line.SUGGESTEDCLASSIFICATION
      const transactionId = line.TRANSACTIONID
      const classification = A.Classification.parseClassification(
        suggestedClassification
      )
      if (classification == null) {
        throw new Error(
          `Unable to parse classification "${suggestedClassification}" for transactionId "${transactionId}" in file ${filename}`
        )
      }
      A.Classification.validateClassification({classification, model})
      ret.push({
        type: "ClassifiedTransaction",
        createdAt: A.Utils.dateToYYYYMMDD(new Date()),
        sourceTransactionId: transactionId,
        classification,
      })
    }
  }
  return ret
}

export function readUnclassifiedLines(
  filename: string
): Array<{[name: string]: string}> {
  if (!A.Utils.fileExists(filename)) {
    return []
  }
  const lines = fs.readFileSync(filename).toString().split("\n")
  const ret: Array<{[name: string]: string}> = []
  let headers: Array<string> | null = null

  let currentColumns: {[name: string]: string} | null = null

  for (const line of lines) {
    // Skip comment lines
    if (!line.startsWith("#")) {
      const columns = line.split("|").map((c) => c.trim())
      if (columns.length > 1) {
        // IF it's the first line, treat it as the headers
        if (headers == null) {
          headers = columns
        } else {
          const columnsObj: {[name: string]: string} = {}
          for (let i = 0; i < columns.length; i++) {
            const header = headers[i]
            const column = columns[i]
            columnsObj[header] = column
          }

          // If there is no "TRANSACTIONID" field, then assume this is
          // a continuation of the previous line, broken at a word
          // boundary.  Essentially, we're undoing the word wrapping
          // performed by columnify
          if (columnsObj.TRANSACTIONID == "") {
            if (currentColumns != null) {
              for (const key of Object.keys(currentColumns)) {
                const oldVal = currentColumns[key]
                const newVal = columnsObj[key]
                if (newVal != null && newVal.length > 0) {
                  currentColumns[key] = `${oldVal} ${newVal}`
                }
              }
            }
          } else {
            if (currentColumns != null) {
              ret.push(currentColumns)
            }
            currentColumns = columnsObj
          }
        }
      }
    }
  }

  if (currentColumns != null) {
    ret.push(currentColumns)
  }

  return ret
}
