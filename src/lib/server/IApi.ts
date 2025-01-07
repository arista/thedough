import {A, M} from "../index.js"

export interface IApi {
  plaidLink: {
    linkToken: {
      create: (
        request: PlaidLinkLinkTokenCreateRequest
      ) => Request<PlaidLinkLinkTokenCreateResponse>
      exchange: (
        request: PlaidLinkTokenExchangeRequest
      ) => Request<PlaidLinkTokenExchangeResponse>
    }
    plaidItem: {
      list: (request: {}) => Request<PlaidLinkPlaidItemListResponse>
    }
  }
  model: {
    entity: {
      list: (request: {}) => Request<ModelEntityListResponse>
    }
  }
}

export interface Request<T> {
  response: Promise<T>
}

export interface PlaidLinkLinkTokenCreateRequest {
  updateItemId?: string
}

export interface PlaidLinkLinkTokenCreateResponse {
  linkToken: string
}

export interface PlaidLinkPlaidItemListResponse {
  items: Array<PlaidItemInfo>
}

export interface PlaidItemInfo {
  name: string
  displayName: string
  plaidItemId: string
}

export interface PlaidLinkTokenExchangeRequest {
  publicToken: string
}

export interface PlaidLinkTokenExchangeResponse {
  accessToken: string
  itemId: string
}

export interface ModelEntityListResponse {
  entities: Array<A.Model.ModelEntityJson>
}
