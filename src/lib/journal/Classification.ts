import {A, M} from "../index.js"
import short from "short-uuid"
import fs from "node:fs"

// An entry in the "unclassifiedTransactions.jsonl" file
export interface UnclassifiedTransaction {
  approved: string
  date: string
  amount: string
  description: string
  account: string
  check: string
  transactionId: string
  suggestedCategory: string
  suggestedClassification: string
}

export type ClassifiedTransactionLine =
  | ClassifiedTransaction
  | RevertClassifiedTransaction

// An entry in the "classifiedTransctions.jsonl" file
export interface ClassifiedTransaction {
  type: "ClassifiedTransaction"
  createdAt: string
  sourceTransactionId: string
  classification: Classification
}

// An entry in the "classifiedTransctions.jsonl" file indicating that
// a previously-classified source transaction should be reverted
export interface RevertClassifiedTransaction {
  type: "RevertClassifiedTransaction"
  createdAt: string
  sourceTransactionId: string
}

export type Classification = AccountClassification

// The journal entry will have a credit (or debit for negative
// amounts) for the account with the same name as what's specified in
// the SourceTransaction, and will have the opposite for the specified
// account
export interface AccountClassification {
  type: "Account"
  account: string
  memo?: string | null
}

export function stringifyClassification(c: Classification): string {
  switch (c.type) {
    case "Account":
      return `Account: "${c.account}"${c.memo ? ` (${c.memo})` : ``}`
  }
}

export function parseClassification(str: string): Classification | null {
  {
    const match = str.match(ACCOUNT_CLASSIFICATION_RE)
    if (match != null) {
      const account = match[1].trim()
      const memoStr = match[3]?.trim()
      const memo = memoStr == null || memoStr == "" ? null : memoStr
      return {
        type: "Account",
        account,
        memo,
      }
    }
  }

  return null
}

const ACCOUNT_CLASSIFICATION_RE =
  /^Account:\s*\"([^\"]+)\"\s*(\(([^\)]*)\))?\s*$/

export function classifiedTransactionToJournalEntry(
  model: M.Model,
  t: ClassifiedTransaction
): A.Journal.JournalEntry | null {
  const {createdAt, sourceTransactionId, classification} = t
  // Skip if the source transaction already has a journal entry
  if (
    model.entities.JournalEntry.bySourceTransactionId.tryGet(
      sourceTransactionId
    ) != null
  ) {
    return null
  }
  const sourceTransaction =
    model.entities.SourceTransaction.byTransactionId.get(sourceTransactionId)
  const {accountName, date, currency, amountInCents} = sourceTransaction

  switch (classification.type) {
    case "Account": {
      const {account, memo} = classification
      const sourceAccount = A.Utils.notNull(
        A.Accounts.findAccount(model, accountName),
        `classification source Account "${accountName}" for transaction "${sourceTransactionId}"`
      )
      const sourceCreditOrDebit = amountInCents >= 0 ? "credit" : "debit"
      const destAccount = A.Utils.notNull(
        A.Accounts.findAccount(model, account),
        `classification dest Account "${account}" for transaction "${sourceTransactionId}"`
      )
      const destCreditOrDebit = amountInCents >= 0 ? "debit" : "credit"
      const absAmountInCents = Math.abs(amountInCents)

      return {
        type: "JournalEntry",
        createdAt: A.Utils.dateToYYYYMMDD(new Date()),
        id: short.generate(),
        date,
        memo,
        sourceTransactionId,
        accounts: [
          {
            accountId: sourceAccount.id,
            creditOrDebit: sourceCreditOrDebit,
            currency,
            amountInCents: absAmountInCents,
          },
          {
            accountId: destAccount.id,
            creditOrDebit: destCreditOrDebit,
            currency,
            amountInCents: absAmountInCents,
          },
        ],
      }
    }
  }
}

export function validateClassification({
  classification,
  model,
}: {
  classification: Classification
  model: M.Model
}) {
  switch (classification.type) {
    case "Account":
      if (!A.Accounts.findAccount(model, classification.account)) {
        throw new Error(
          `Classification specifies account "${classification.account}" which either doesn't exist or is ambiguous`
        )
      }
      break
    default:
      const unexpected: never = classification.type
  }
}

export function readClassifiedTransactions({
  classifiedTransactionsFilename,
}: {
  classifiedTransactionsFilename: string
}): Array<ClassifiedTransaction> {
  if (!A.Utils.fileExists(classifiedTransactionsFilename)) {
    return []
  }
  const str = fs.readFileSync(classifiedTransactionsFilename).toString()
  const lines = str
    .split("\n")
    .filter((l) => !l.startsWith("#") && l.trim().length !== 0)
  const tlines: Array<ClassifiedTransactionLine> = lines.map((l) =>
    JSON.parse(l)
  )
  let ret: Array<ClassifiedTransaction> = []
  for (const tline of tlines) {
    switch (tline.type) {
      case "ClassifiedTransaction":
        ret.push(tline)
        break
      case "RevertClassifiedTransaction":
        // Not the most efficient way to remove transactions, but
        // it'll work for now
        ret = ret.filter(
          (t) => t.sourceTransactionId != tline.sourceTransactionId
        )
        break
      default:
        const unexpected: never = tline
    }
  }
  return ret
}
