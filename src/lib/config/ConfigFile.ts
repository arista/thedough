import * as Plaid from "plaid"

export interface ConfigFile {
  plaidConfig: PlaidConfig
}

export interface PlaidConfig {
  plaidClientId: string
  plaidSecret: string
  clientUserId: string
  clientName: string
  products: Products
  countryCodes: CountryCodes
  plaidItems: {[name: string]: PlaidItemConfig}
}

export type Products = Array<Plaid.Products>
export type CountryCodes = Array<Plaid.CountryCode>

export interface PlaidItemConfig {
  displayName: string
  plaidAccessToken: string
  plaidItemId: string
  accounts: {[name: string]: PlaidAccountConfig}
}

export interface PlaidAccountConfig {
  displayName: string
  plaidAccountId: string
}
