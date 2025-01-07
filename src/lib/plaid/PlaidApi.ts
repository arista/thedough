import {A, M} from "../index.js"
import * as Plaid from "plaid"

export class PlaidApi {
  constructor(
    public props: {
      config: M.entities.PlaidConfig
    }
  ) {}

  _configuration: Plaid.Configuration | null = null
  get configuration(): Plaid.Configuration {
    const {plaidClientId, plaidSecret} = this.props.config
    return (this._configuration ||= new Plaid.Configuration({
      basePath: Plaid.PlaidEnvironments.production,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": plaidClientId,
          "PLAID-SECRET": plaidSecret,
        },
      },
    }))
  }

  _plaidClient: Plaid.PlaidApi | null = null
  get plaidClient(): Plaid.PlaidApi {
    return (this._plaidClient ||= new Plaid.PlaidApi(this.configuration))
  }

  getAccessToken(plaidItemName: string): string {
    return this.props.config.plaidItems.byName.get(plaidItemName)
      .plaidAccessToken
  }

  async createPlaidLinkToken(
    request: CreatePlaidLinkTokenRequest
  ): Promise<Plaid.LinkTokenCreateResponse> {
    const {clientUserId, clientName, products, countryCodes} = this.props.config

    const plaidRequest: Plaid.LinkTokenCreateRequest = {
      user: {
        client_user_id: clientUserId,
      },
      client_name: clientName,
      products: products,
      country_codes: countryCodes,
      language: "en",
    }
    if (request.updateMode != null) {
      plaidRequest.access_token = request.updateMode.itemAccessToken
      plaidRequest.update = {}
    }
    const axiosResult = await this.plaidClient.linkTokenCreate(plaidRequest)
    const result: Plaid.LinkTokenCreateResponse = axiosResult.data
    return result
  }

  async exchangePublicToken(
    request: ExchangePlaidLinkTokenRequest
  ): Promise<Plaid.ItemPublicTokenExchangeResponse> {
    const axiosResult = await this.plaidClient.itemPublicTokenExchange({
      public_token: request.publicToken,
    })
    const result: Plaid.ItemPublicTokenExchangeResponse = axiosResult.data
    return result
  }

  async getAccounts(
    request: GetAccountsRequest
  ): Promise<Plaid.AccountsGetResponse> {
    const access_token = this.getAccessToken(request.plaidItemName)
    const axiosResult = await this.plaidClient.accountsGet({
      access_token,
      options: {},
    })
    const result: Plaid.AccountsGetResponse = axiosResult.data
    return result
  }

  async getItem(request: GetItemRequest): Promise<Plaid.ItemGetResponse> {
    const access_token = this.getAccessToken(request.plaidItemName)
    const axiosResult = await this.plaidClient.itemGet({
      access_token,
    })
    const result: Plaid.ItemGetResponse = axiosResult.data
    return result
  }

  async getTransactions(
    request: GetTransactionsRequest
  ): Promise<Plaid.TransactionsGetResponse> {
    //    console.log(`getTransactions: ${JSON.stringify(request, null, 2)}`)
    const axiosResult = await this.plaidClient.transactionsGet({
      access_token: this.getAccessToken(request.plaidItemName),
      start_date: request.startDate,
      end_date: request.endDate,
      options: {
        count: request.count,
        offset: request.offset,
        include_original_description: true,
      },
    })
    const result: Plaid.TransactionsGetResponse = axiosResult.data
    return result
  }
}

export interface GetTransactionsRequest {
  plaidItemName: string
  startDate: string
  endDate: string
  count: number
  offset: number
}

export interface GetAccountsRequest {
  plaidItemName: string
}

export interface GetItemRequest {
  plaidItemName: string
}

export interface CreatePlaidLinkTokenRequest {
  updateMode?: {
    itemAccessToken: string
  }
}

export interface ExchangePlaidLinkTokenRequest {
  publicToken: string
}
