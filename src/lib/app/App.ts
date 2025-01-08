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

  _configFile: Promise<M.ConfigFile> | null = null
  get configFile(): Promise<M.ConfigFile> {
    return (this._configFile ||= (async () =>
      (await import(this.configFileName)).Config)())
  }

  _config: Promise<M.entities.Config> | null = null
  get config(): Promise<M.entities.Config> {
    return (this._config ||= (async () =>
      M.readConfig({
        model: this.model,
        configFile: await this.configFile,
      }))())
  }

  _dataDirectory: Promise<string> | null = null
  get dataDirectory(): Promise<string> {
    return (this._dataDirectory ||= (async () =>
      (await this.configFile).dataDirectory)())
  }

  _plaidConfig: Promise<M.entities.PlaidConfig> | null = null
  get plaidConfig(): Promise<M.entities.PlaidConfig> {
    return (this._plaidConfig ||= (async () =>
      (await this.config).plaidConfig)())
  }

  _plaidApi: Promise<M.PlaidApi> | null = null
  get plaidApi(): Promise<M.PlaidApi> {
    return (this._plaidApi ||= (async () => {
      const plaidConfig = this.plaidConfig
      return new M.PlaidApi({
        config: await this.plaidConfig,
      })
    })())
  }

  _sourceTransactionPaths: Promise<M.SourceTransactionPaths> | null = null
  get sourceTransactionPaths(): Promise<M.SourceTransactionPaths> {
    return (this._sourceTransactionPaths ||= (async () =>
      new M.SourceTransactionPaths({
        dataDirectory: await this.dataDirectory,
      }))())
  }

  _transactionDownloader: Promise<M.TransactionDownloader> | null = null
  get transactionDownloader(): Promise<M.TransactionDownloader> {
    return (this._transactionDownloader ||= (async () => {
      const config = this.config
      return new M.TransactionDownloader({
        plaidConfig: await this.plaidConfig,
        plaidApi: await this.plaidApi,
        sourceTransactionPaths: await this.sourceTransactionPaths,
      })
    })())
  }

  _sourceTransactionLoader: Promise<M.SourceTransactionLoader> | null = null
  get sourceTransactionLoader(): Promise<M.SourceTransactionLoader> {
    return (this._sourceTransactionLoader ||= (async () => {
      const config = this.config
      return new M.SourceTransactionLoader({
        model: this.model,
        plaidConfig: await this.plaidConfig,
        sourceTransactionPaths: await this.sourceTransactionPaths,
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
    const transactionDownloader = await this.transactionDownloader
    await transactionDownloader.downloadTransactions()
  }

  async getAccounts() {
    const plaidApi = await this.plaidApi
    const plaidItems = (await this.plaidConfig).plaidItems
    const accounts = await Promise.all(
      plaidItems.entitiesArray.map(async (plaidItemConfig) => {
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
    const plaidApi = await this.plaidApi
    const plaidItems = (await this.plaidConfig).plaidItems
    const items = await Promise.all(
      plaidItems.entitiesArray.map(async (plaidItemConfig) => {
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

  async getJournalConfig(configName: string): Promise<M.JournalConfig> {
    const configFile = await this.configFile
    const journalConfigFn = A.Utils.notNull(
      configFile.journalConfigs[configName],
      `searching journalConfigs for "${configName}"`
    )
    const journalConfig = journalConfigFn()
    return journalConfig
  }

  async loadJournal({
    model,
    configName,
  }: {
    model: M.Model
    configName: string
  }): Promise<{
    journalDir: string
    journalConfig: M.JournalConfig
    journalEntriesFilename: string
    classifiedTransactionsFilename: string
    classifiedTransactions: Array<A.Classification.ClassifiedTransaction>
    sourceTransactionsFilename: string
  }> {
    const journalConfig = await this.getJournalConfig(configName)
    const {startDate, endDate, chartOfAccounts} = journalConfig
    A.Accounts.createAccounts(model, chartOfAccounts)
    A.Accounts.checkPlaidAccounts(model)

    const dataDirectory = await this.dataDirectory
    const journalDir = Path.join(
      dataDirectory,
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
    await this.loadBudget({configName, model})

    return {
      journalDir,
      journalEntriesFilename,
      journalConfig,
      classifiedTransactionsFilename,
      classifiedTransactions,
      sourceTransactionsFilename,
    }
  }

  async loadBudget({model, configName}: {model: M.Model; configName: string}) {
    const configFile = await this.configFile
    const budgetConfigFn = A.Utils.notNull(
      configFile.budgetConfigs[configName],
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
    } = await this.loadJournal({model, configName})
    const {startDate, endDate, classificationRules} = journalConfig

    console.log(`Downloading new source transactions`)
    const transactionDownloader = await this.transactionDownloader
    transactionDownloader.downloadTransactions()

    console.log(`Loading old and new source transactions`)
    const newSourceTransactions = await this._loadNewSourceTransactions({
      startDate,
      endDate,
      model,
    })
    console.log(
      `  Loaded ${newSourceTransactions.length} new source transactions from between ${A.Utils.dateToYYYYMMDD(startDate)} and ${A.Utils.dateToYYYYMMDD(endDate)}`
    )
    if (newSourceTransactions.length > 0) {
      this._writeNewSourceTransactions({
        newSourceTransactions,
        sourceTransactionsFilename,
      })
    }

    const newScheduledSourceTransactions =
      await this._loadNewScheduledSourceTransactions({
        startDate,
        endDate,
        model,
        configName,
      })
    console.log(
      `  Loaded ${newScheduledSourceTransactions.length} new scheduled source transactions from between ${A.Utils.dateToYYYYMMDD(startDate)} and ${A.Utils.dateToYYYYMMDD(endDate)}`
    )
    if (newScheduledSourceTransactions.length > 0) {
      this._writeNewSourceTransactions({
        newSourceTransactions: newScheduledSourceTransactions,
        sourceTransactionsFilename,
      })
    }

    const newEversourceSourceTransactions =
      await this._loadNewEversourceSourceTransactions({
        startDate,
        endDate,
        model,
        configName,
      })
    console.log(
      `  Loaded ${newEversourceSourceTransactions.length} new eversource source transactions from between ${A.Utils.dateToYYYYMMDD(startDate)} and ${A.Utils.dateToYYYYMMDD(endDate)}`
    )
    if (newEversourceSourceTransactions.length > 0) {
      this._writeNewSourceTransactions({
        newSourceTransactions: newEversourceSourceTransactions,
        sourceTransactionsFilename,
      })
    }

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
    await this.loadBudget({configName, model})
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
    } = await this.loadJournal({model, configName})

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

  async _loadNewSourceTransactions({
    startDate,
    endDate,
    model,
  }: {
    startDate: Date
    endDate: Date
    model: M.Model
  }): Promise<Array<A.Model.entities.SourceTransaction>> {
    const loader = await this.sourceTransactionLoader
    return await loader.loadNewPlaidTransactions({startDate, endDate})
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
    fs.mkdirSync(Path.dirname(sourceTransactionsFilename), {recursive: true})
    fs.writeFileSync(sourceTransactionsFilename, str, {flag: "a"})
    console.log(
      `  Wrote ${newSourceTransactions.length} new SourceTransactions to ${sourceTransactionsFilename}`
    )
  }

  async _loadNewScheduledSourceTransactions({
    startDate,
    endDate,
    model,
    configName,
  }: {
    startDate: Date
    endDate: Date
    model: M.Model
    configName: string
  }): Promise<Array<A.Model.entities.SourceTransaction>> {
    const journalConfig = await this.getJournalConfig(configName)
    const scheduledSourceTransactions =
      journalConfig.scheduledSourceTransactions ?? []
    const loader = await this.sourceTransactionLoader
    return await loader.loadNewScheduledSourceTransactions(
      {startDate, endDate},
      scheduledSourceTransactions
    )
  }

  async _loadNewEversourceSourceTransactions({
    startDate,
    endDate,
    model,
    configName,
  }: {
    startDate: Date
    endDate: Date
    model: M.Model
    configName: string
  }): Promise<Array<A.Model.entities.SourceTransaction>> {
    const journalConfig = await this.getJournalConfig(configName)
    const loader = await this.sourceTransactionLoader
    return await loader.loadNewEversourceSourceTransactions(
      {startDate, endDate},
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
