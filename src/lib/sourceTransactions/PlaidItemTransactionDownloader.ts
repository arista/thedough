import {A, M} from "../index.js"
import Path from "node:path"
import fs from "node:fs"
import short from "short-uuid"

const DEFAULT_REQUEST_COUNT = 100

export class PlaidItemTransactionDownloader {
  constructor(
    public props: {
      plaidItemConfig: M.entities.PlaidItemConfig
      transactionsDir: string
      plaidApi: M.PlaidApi
    }
  ) {}

  async runNextRequest(): Promise<{complete: boolean}> {
    const nextRequest = this.getNextRequest()
    if (nextRequest == null) {
      return {complete: true}
    }
    const {startDate, endDate, count, offset} = nextRequest
    const filename = this.getRequestFilename(nextRequest)
    const {plaidItemConfig, plaidApi} = this.props
    const {name} = plaidItemConfig
    const plaidResponse = await plaidApi.getTransactions({
      plaidItemName: name,
      startDate,
      endDate,
      count,
      offset,
    })

    const responseCount = plaidResponse.transactions.length
    if (responseCount > 0) {
      const outputFilename = Path.join(this.props.transactionsDir, filename)
      fs.mkdirSync(Path.dirname(outputFilename), {recursive: true})
      fs.writeFileSync(outputFilename, JSON.stringify(plaidResponse, null, 2))
    }

    const downloadResponse: DownloadResponse = {
      type: "PlaidDownloadResponse",
      id: short.generate(),
      timestamp: new Date().getTime(),
      request: nextRequest,
      filename: responseCount > 0 ? filename : null,
      responseCount,
      totalTransactionsCount: plaidResponse.total_transactions,
    }
    this.writeDownloadResponse(downloadResponse)
    return {complete: false}
  }

  getNextRequest(): DownloadRequest | null {
    const latest = this.getLatestResponse()
    if (latest == null) {
      return this.getInitialRequest()
    } else if (!this.isTimePeriodComplete(latest)) {
      return this.getNextRequestInTimePeriod(latest)
    } else if (!this.isUpToDate(latest)) {
      return this.getRequestForNextTimePeriod(latest)
    } else {
      return null
    }
  }

  getLatestResponseFile(): string {
    return Path.join(this.props.transactionsDir, "latestDownloadResponse.json")
  }

  getResponsesFile(): string {
    return Path.join(this.props.transactionsDir, "downloadResponses.jsonl")
  }

  getLatestResponse(): DownloadResponse | null {
    const latestResponseFile = this.getLatestResponseFile()
    if (A.Utils.fileExists(latestResponseFile)) {
      return A.Utils.readJsonFile(latestResponseFile)
    } else {
      return null
    }
  }

  getInitialRequest(): DownloadRequest {
    const today = A.DateUtils.midnightOf(new Date())
    const startDate = A.DateUtils.plus(today, {years: -1})
    const endDate = A.DateUtils.min(
      today,
      A.DateUtils.plus(startDate, {months: 1})
    )
    return {
      startDate: A.DateUtils.toYYYY_MM_DD(startDate),
      endDate: A.DateUtils.toYYYY_MM_DD(endDate),
      offset: 0,
      count: DEFAULT_REQUEST_COUNT,
    }
  }

  isTimePeriodComplete(response: DownloadResponse): boolean {
    return (
      response.request.offset + response.responseCount >=
      response.totalTransactionsCount
    )
  }

  getNextRequestInTimePeriod(response: DownloadResponse): DownloadRequest {
    const {startDate, endDate} = response.request
    return {
      startDate,
      endDate,
      offset: response.request.offset + response.responseCount,
      count: DEFAULT_REQUEST_COUNT,
    }
  }

  isUpToDate(response: DownloadResponse): boolean {
    const today = A.DateUtils.midnightOf(new Date())
    const latestEndDate = A.DateUtils.midnightOf(
      new Date(response.request.endDate)
    )
    return latestEndDate >= today
  }

  getRequestForNextTimePeriod(response: DownloadResponse): DownloadRequest {
    const latestEndDate = new Date(response.request.endDate)
    const today = A.DateUtils.midnightOf(new Date())
    const startDate = A.DateUtils.plus(latestEndDate, {days: -1})
    const endDate = A.DateUtils.min(
      today,
      A.DateUtils.plus(startDate, {months: 1, days: 1})
    )
    return {
      startDate: A.DateUtils.toYYYY_MM_DD(startDate),
      endDate: A.DateUtils.toYYYY_MM_DD(endDate),
      offset: 0,
      count: DEFAULT_REQUEST_COUNT,
    }
  }

  getRequestFilename(request: DownloadRequest): string {
    const startDate = new Date(request.startDate)
    const endDate = new Date(request.endDate)
    return Path.join(
      "byEndingYear",
      endDate.getFullYear().toString().padStart(4, "0"),
      `transactions-${A.DateUtils.toYYYYMMDD(startDate)}-${A.DateUtils.toYYYYMMDD(endDate)}-${request.offset}-${Math.floor(new Date().getTime() / 1000.0)}.json`
    )
  }

  writeDownloadResponse(response: DownloadResponse) {
    const canonicalResponse = A.Utils.toCanonicalJson(response)
    fs.mkdirSync(Path.dirname(this.getResponsesFile()), {recursive: true})
    fs.appendFileSync(this.getResponsesFile(), `${canonicalResponse}\n`)
    fs.mkdirSync(Path.dirname(this.getLatestResponseFile()), {recursive: true})
    fs.writeFileSync(
      this.getLatestResponseFile(),
      JSON.stringify(response, null, 2)
    )
    console.log(
      `${this.props.plaidItemConfig.name}: ${response.request.startDate} - ${response.request.endDate}, ${response.request.offset}+${response.responseCount} / ${response.totalTransactionsCount}`
    )
  }
}

export interface DownloadResponse {
  type: "PlaidDownloadResponse"
  id: string
  timestamp: number
  request: DownloadRequest
  responseCount: number
  totalTransactionsCount: number
  filename: string | null
}

export interface DownloadRequest {
  startDate: string
  endDate: string
  offset: number
  count: number
}
