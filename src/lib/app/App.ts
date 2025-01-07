import {A, M} from "../index.js"
import Path from "node:path"
import fs from "node:fs"
import columnify from "columnify"

export interface AppProps {}

export class App {
  constructor(public props: AppProps) {}

  _model: M.Model | null = null
  get model(): M.Model {
    return (this._model ||= A.AppModel.createModel())
  }

  _configFileName: string | null = null
  get configFileName(): string {
    return (this._configFileName ||= A.Utils.notNull(
      process.env["THEDOUGH_CONFIG_FILE"],
      "Environment variable THEDOUGH_CONFIG_FILE"
    ))
  }

  _configFile: M.ConfigFile | null = null
  get configFile(): M.ConfigFile {
    return (this._configFile ||= require(this.configFileName))
  }

  _config: M.entities.Config | null = null
  get config(): M.entities.Config {
    return (this._config ||= M.readConfig({
      model: this.model,
      configFile: this.configFile,
    }))
  }

  _dataDirectory: string | null = null
  get dataDirectory(): string {
    return (this._dataDirectory ||= this.configFile.dataDirectory)
  }

  _plaidConfig: M.entities.PlaidConfig | null = null
  get plaidConfig(): M.entities.PlaidConfig {
    return (this._plaidConfig ||= this.config.plaidConfig)
  }

  _plaidApi: M.PlaidApi | null = null
  get plaidApi(): M.PlaidApi {
    return (this._plaidApi ||= (() => {
      const plaidConfig = this.plaidConfig
      return new M.PlaidApi({
        config: this.plaidConfig,
      })
    })())
  }

  _sourceTransactionPaths: M.SourceTransactionPaths | null = null
  get sourceTransactionPaths(): M.SourceTransactionPaths {
    return (this._sourceTransactionPaths ||= new M.SourceTransactionPaths({
      dataDirectory: this.dataDirectory,
    }))
  }

  _transactionDownloader: M.TransactionDownloader | null = null
  get transactionDownloader(): M.TransactionDownloader {
    return (this._transactionDownloader ||= (() => {
      const config = this.config
      return new M.TransactionDownloader({
        plaidConfig: this.plaidConfig,
        plaidApi: this.plaidApi,
        sourceTransactionPaths: this.sourceTransactionPaths,
      })
    })())
  }

  _sourceTransactionLoader: M.SourceTransactionLoader | null = null
  get sourceTransactionLoader(): M.SourceTransactionLoader {
    return (this._sourceTransactionLoader ||= (() => {
      const config = this.config
      return new M.SourceTransactionLoader({
        model: this.model,
        plaidConfig: this.plaidConfig,
        sourceTransactionPaths: this.sourceTransactionPaths,
      })
    })())
  }

  static async withApp<T>(
    props: AppProps,
    f: (app: App) => Promise<T>
  ): Promise<T> {
    const app = new App(props)
    try {
      return f(app)
    } finally {
    }
  }

  async downloadTransactions() {
    const {transactionDownloader} = this
    await transactionDownloader.downloadTransactions()
  }

  async getAccounts() {
    const {plaidApi} = this
    const accounts = await Promise.all(
      this.plaidConfig.plaidItems.entitiesArray.map(async (plaidItemConfig) => {
        const {name} = plaidItemConfig
        const accounts = await plaidApi.getAccounts({plaidItemName: name})
        return {
          plaidItemName: name,
          accounts: accounts.accounts.map((account) => {
            return {
              plaidAccountId: account.account_id,
              persistentAccountId: account.persistent_account_id,
              name: account.name,
              officialName: account.official_name,
              mask: account.mask,
              type: account.type,
              subtype: account.subtype,
              availableBalance: account.balances.available,
              currentBalance: account.balances.current,
              limitBalance: account.balances.limit,
            }
          }),
        }
      })
    )
    return {
      accounts,
    }
  }

  async getItems() {
    const {plaidApi} = this
    const items = await Promise.all(
      this.plaidConfig.plaidItems.entitiesArray.map(async (plaidItemConfig) => {
        const {name} = plaidItemConfig
        const item = await plaidApi.getItem({plaidItemName: name})
        return {
          plaidItemName: name,
          plaidItemId: item.item.item_id,
          plaidInstitutionId: item.item.institution_id,
        }
      })
    )
    return {
      items,
    }
  }

  loadTransactions({
    startDate,
    endDate,
  }: {
    startDate: Date
    endDate: Date
  }): Array<M.entities.SourceTransaction> {
    const loader = this.sourceTransactionLoader
    loader.loadNewPlaidTransactions({startDate, endDate})
    return this.model.entities.SourceTransaction.all.entitiesArray
  }

  loadJournal({model, configName}: {model: M.Model; configName: string}): {
    journalDir: string
    journalConfig: M.JournalConfig
    journalEntriesFilename: string
    classifiedTransactionsFilename: string
    classifiedTransactions: Array<A.Classification.ClassifiedTransaction>
    sourceTransactionsFilename: string
  } {
    const journalConfigFn = A.Utils.notNull(
      this.configFile.journalConfigs[configName],
      `searching journalConfigs for "${configName}"`
    )
    const journalConfig = journalConfigFn()
    const {startDate, endDate, chartOfAccounts} = journalConfig
    A.Accounts.createAccounts(model, chartOfAccounts)
    A.Accounts.checkPlaidAccounts(model)

    const journalDir = Path.join(
      this.dataDirectory,
      "journals",
      journalConfig.journalDir
    )
    console.log(`Loading existing journal from ${journalDir}`)

    // Load entries from the existing journal into the model
    const journalEntriesFilename = Path.join(journalDir, "journalEntries.jsonl")
    const existingJournalEntries = this._loadJournalEntries({
      journalEntriesFilename,
    })
    this._addJournalEntries({
      journalEntries: existingJournalEntries,
      model,
    })
    if (existingJournalEntries.length > 0) {
      console.log(
        `  Loaded ${existingJournalEntries.length} journal entries from ${journalEntriesFilename}`
      )
    }

    // Load all of the classified transactions
    const classifiedTransactionsFilename = Path.join(
      journalDir,
      "classifiedTransactions.jsonl"
    )
    const classifiedTransactions = A.Classification.readClassifiedTransactions({
      classifiedTransactionsFilename,
    })
    if (classifiedTransactions.length > 0) {
      console.log(
        `  Loaded ${classifiedTransactions.length} classified transactions from ${classifiedTransactionsFilename}`
      )
    }

    // Load the source transactions that were previously recorded in
    // the journal
    const sourceTransactionsFilename = Path.join(
      journalDir,
      "sourceTransactions.jsonl"
    )
    this._loadSourceTransactions({
      sourceTransactionsFilename,
      model,
    })
    const sourceTransactions =
      model.entities.SourceTransaction.all.entitiesArray
    if (sourceTransactions.length > 0) {
      console.log(
        `  Loaded ${sourceTransactions.length} source transactions from ${sourceTransactionsFilename}`
      )
    }

    // Add the budget entries
    this.loadBudget({configName, model})

    return {
      journalDir,
      journalEntriesFilename,
      journalConfig,
      classifiedTransactionsFilename,
      classifiedTransactions,
      sourceTransactionsFilename,
    }
  }

  loadBudget({model, configName}: {model: M.Model; configName: string}) {
    const budgetConfigFn = A.Utils.notNull(
      this.configFile.budgetConfigs[configName],
      `searching budgetConfigs for "${configName}"`
    )
    const budgetConfig = budgetConfigFn()
    const {startDate, endDate, entries} = budgetConfig

    A.ScheduledEntry.addScheduledJournalEntries({
      entries,
      startDate,
      endDate,
      model,
      budgetOrActual: "budget",
    })
  }

  async run({configName}: {configName: string}) {
    const {model} = this

    console.log(
      `Using configuration "${configName}" found in JournalConfigs.ts`
    )
    const {
      journalConfig,
      journalDir,
      journalEntriesFilename,
      classifiedTransactionsFilename,
      classifiedTransactions,
      sourceTransactionsFilename,
    } = this.loadJournal({model, configName})
    const {startDate, endDate, classificationRules} = journalConfig

    console.log(`Downloading new source transactions`)
    await this.transactionDownloader.downloadTransactions()

    console.log(`Loading old and new source transactions`)
    const newSourceTransactions = this._loadNewSourceTransactions({
      startDate,
      endDate,
      model,
    })
    console.log(
      `  Loaded ${newSourceTransactions.length} new source transactions from between ${A.Utils.dateToYYYYMMDD(startDate)} and ${A.Utils.dateToYYYYMMDD(endDate)}`
    )
    this._writeNewSourceTransactions({
      newSourceTransactions,
      sourceTransactionsFilename,
    })

    const unclassifiedTransactionsFilename = Path.join(
      journalDir,
      "forReview.csv"
    )
    const forReviewFilename = Path.join(journalDir, "forReview.csv")

    // If there are classified transactions that somehow didn't get
    // written to the journal, add them now and load them into the
    // model
    const missedJournalEntries =
      this._createJournalEntriesFromClassifiedTransactions({
        classifiedTransactions,
        journalEntriesFilename,
        model,
      })
    if (missedJournalEntries.length > 0) {
      console.log(
        `Adding ${missedJournalEntries.length} "missed" journal entries from those already-classified transactions`
      )
    }
    this._addJournalEntries({
      journalEntries: missedJournalEntries,
      model,
    })

    // Check the "forReview" file to see if any classifications have
    // been approved for unclassified transactions
    const newlyClassifiedTransactions = this._addNewlyClassifiedTransactions({
      unclassifiedTransactionsFilename,
      classifiedTransactionsFilename,
      model,
    })
    if (newlyClassifiedTransactions.length > 0) {
      console.log(
        `Added ${newlyClassifiedTransactions.length} classification(s) to ${classifiedTransactionsFilename}`
      )
    }

    // Add journal entries for those newly-created transactions and
    // load them into the model
    const newJournalEntries =
      this._createJournalEntriesFromClassifiedTransactions({
        classifiedTransactions: newlyClassifiedTransactions,
        journalEntriesFilename,
        model,
      })
    if (newJournalEntries.length > 0) {
      console.log(
        `Added ${newJournalEntries.length} new journal entries to ${journalEntriesFilename}`
      )
    }
    this._addJournalEntries({
      journalEntries: newJournalEntries,
      model,
    })

    // Put together the list of transactions that still need to be
    // classified
    const sourceTransactions =
      model.entities.SourceTransaction.byDate.entitiesArray
    const unclassifiedTransactions = sourceTransactions.filter(
      (t) => t.journalEntry == null
    )
    A.ClassificationRule.validateClassificationRules(model, classificationRules)
    const unclassified = A.Unclassified.writeUnclassifiedTransactions({
      filename: forReviewFilename,
      transactions: unclassifiedTransactions,
      classificationRules,
    })
    const suggestionCount = unclassified.filter(
      (t) => t.suggestedClassification != ""
    ).length
    if (unclassifiedTransactions.length > 0) {
      console.log(
        `Wrote ${unclassifiedTransactions.length} unclassified transaction(s) to ${forReviewFilename}`
      )
      console.log(`  Suggested ${suggestionCount} classification(s)`)
    } else {
      console.log(`No transactions need to be reveiwed!`)
    }

    // Add the budget entries
    this.loadBudget({configName, model})
  }

  async unclassify({
    configName,
    sourceTransactionId,
  }: {
    configName: string
    sourceTransactionId: string
  }) {
    const {model} = this

    const {
      journalEntriesFilename,
      classifiedTransactionsFilename,
      classifiedTransactions,
    } = this.loadJournal({model, configName})

    const classifiedTransactionsBySourceTransactionId = new Map<
      string,
      A.Classification.ClassifiedTransaction
    >()
    for (const t of classifiedTransactions) {
      classifiedTransactionsBySourceTransactionId.set(t.sourceTransactionId, t)
    }

    const classifiedTransaction =
      classifiedTransactionsBySourceTransactionId.get(sourceTransactionId)
    if (classifiedTransaction == null) {
      console.log(
        `Warning: no classifed transaction found for sourceTransactionId "${sourceTransactionId}" in ${classifiedTransactionsFilename}`
      )
    } else {
      const line: A.Classification.RevertClassifiedTransaction = {
        type: "RevertClassifiedTransaction",
        createdAt: A.Utils.dateToYYYYMMDD(new Date()),
        sourceTransactionId,
      }
      const str = A.Utils.toCanonicalJson(line)
      fs.writeFileSync(classifiedTransactionsFilename, str, {flag: "a"})
      console.log(
        `Wrote RevertClassifiedTransaction of ${sourceTransactionId} to ${classifiedTransactionsFilename}`
      )
    }

    const journalEntry =
      model.entities.JournalEntry.bySourceTransactionId.tryGet(
        sourceTransactionId
      )
    if (journalEntry == null) {
      console.log(
        `Warning: no journal entry found for sourceTransactionId "${sourceTransactionId}" in ${journalEntriesFilename}`
      )
    } else {
      const line: A.Journal.RevertJournalEntry = {
        type: "RevertJournalEntry",
        createdAt: A.Utils.dateToYYYYMMDD(new Date()),
        journalEntryId: journalEntry.id,
      }
      const str = A.Utils.toCanonicalJson(line)
      fs.writeFileSync(journalEntriesFilename, str, {flag: "a"})
      console.log(
        `Wrote RevertJournalEntry of entry ${journalEntry.id} to ${journalEntriesFilename}`
      )
    }

    console.log(
      `NOTE: Be sure to run "thedough run -c ${configName}" to update the forReview file`
    )
  }

  _loadNewSourceTransactions({
    startDate,
    endDate,
    model,
  }: {
    startDate: Date
    endDate: Date
    model: M.Model
  }): Array<A.Model.entities.SourceTransaction> {
    // Include transactions from the surrounding years, just in case
    // there are any that border.  Then whittle them down
    const startYear = startDate.getFullYear() - 1
    const endYear = endDate.getFullYear() + 1
    const loader = this.sourceTransactionLoader
    return loader.loadNewPlaidTransactions({startDate, endDate})
  }

  _writeNewSourceTransactions({
    newSourceTransactions,
    sourceTransactionsFilename,
  }: {
    newSourceTransactions: Array<A.Model.entities.SourceTransaction>
    sourceTransactionsFilename: string
  }) {
    const str =
      newSourceTransactions.map((t) => JSON.stringify(t.toJSON())).join("\n") +
      "\n"
    fs.writeFileSync(sourceTransactionsFilename, str, {flag: "a"})
    console.log(
      `  Wrote ${newSourceTransactions.length} new SourceTransactions to ${sourceTransactionsFilename}`
    )
  }

  _loadJournalEntries({
    journalEntriesFilename,
  }: {
    journalEntriesFilename: string
  }): Array<A.Journal.JournalEntryLine> {
    if (!A.Utils.fileExists(journalEntriesFilename)) {
      return []
    }
    const str = fs.readFileSync(journalEntriesFilename).toString()
    const lines = str
      .split("\n")
      .filter((l) => !l.startsWith("#") && l.trim().length !== 0)
    const ret: Array<A.Journal.JournalEntryLine> = lines.map((l) =>
      JSON.parse(l)
    )
    return ret
  }

  _loadSourceTransactions({
    sourceTransactionsFilename,
    model,
  }: {
    sourceTransactionsFilename: string
    model: M.Model
  }) {
    if (!A.Utils.fileExists(sourceTransactionsFilename)) {
      return []
    }
    const str = fs.readFileSync(sourceTransactionsFilename).toString()
    const lines = str
      .split("\n")
      .filter((l) => !l.startsWith("#") && l.trim().length !== 0)
    const tlines: Array<M.ModelEntityJson> = lines.map((l) => JSON.parse(l))
    for (const tline of tlines) {
      model.entityFromJson(tline)
    }
  }

  _addJournalEntries({
    journalEntries,
    model,
  }: {
    journalEntries: Array<A.Journal.JournalEntryLine>
    model: M.Model
  }) {
    A.Journal.addJournalEntries(model, journalEntries)
  }

  // See if there are any classified transactions that haven't yet
  // been entered into the journal
  _createJournalEntriesFromClassifiedTransactions({
    classifiedTransactions,
    journalEntriesFilename,
    model,
  }: {
    classifiedTransactions: Array<A.Classification.ClassifiedTransaction>
    journalEntriesFilename: string
    model: M.Model
  }): Array<A.Journal.JournalEntry> {
    const ret: Array<A.Journal.JournalEntry> = []
    for (const t of classifiedTransactions) {
      const journalEntry = A.Classification.classifiedTransactionToJournalEntry(
        model,
        t
      )
      if (journalEntry != null) {
        ret.push(journalEntry)
      }
    }

    if (ret.length > 0) {
      const str = ret.map((t) => A.Utils.toCanonicalJson(t)).join("\n") + "\n"
      fs.mkdirSync(Path.dirname(journalEntriesFilename), {recursive: true})
      fs.writeFileSync(journalEntriesFilename, str, {flag: "a"})
    }
    return ret
  }

  // Add newly approved transactions found in the unclassified transactions list
  _addNewlyClassifiedTransactions({
    unclassifiedTransactionsFilename,
    classifiedTransactionsFilename,
    model,
  }: {
    unclassifiedTransactionsFilename: string
    classifiedTransactionsFilename: string
    model: M.Model
  }): Array<A.Classification.ClassifiedTransaction> {
    const classifiedTransactions =
      A.Unclassified.readNewlyClassifiedTransactions({
        filename: unclassifiedTransactionsFilename,
        model,
      })
    if (classifiedTransactions.length > 0) {
      const str =
        classifiedTransactions
          .map((t) => A.Utils.toCanonicalJson(t))
          .join("\n") + "\n"
      fs.mkdirSync(Path.dirname(classifiedTransactionsFilename), {
        recursive: true,
      })
      fs.writeFileSync(classifiedTransactionsFilename, str, {flag: "a"})
    }
    return classifiedTransactions
  }
}
