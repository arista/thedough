import {A, M} from "../index.js"

export function createServerApi({
  app,
  configName,
}: {
  app: M.App
  configName: string
}): M.IApi {
  const {plaidApi, model} = app

  function plaidLinkLinkTokenCreate(
    request: A.IApi.PlaidLinkLinkTokenCreateRequest
  ): A.IApi.Request<A.IApi.PlaidLinkLinkTokenCreateResponse> {
    return {
      response: (async () => {
        const plaidRequest: A.PlaidApi.CreatePlaidLinkTokenRequest = {}
        const {updateItemId} = request
        if (updateItemId != null) {
          const itemConfig =
            model.entities.PlaidItemConfig.byPlaidItemId.get(updateItemId)
          plaidRequest.updateMode = {
            itemAccessToken: itemConfig.plaidAccessToken,
          }
        }

        const r = await plaidApi.createPlaidLinkToken(plaidRequest)
        return {
          linkToken: r.link_token,
        }
      })(),
    }
  }

  function plaidLinkTokenExchange(
    request: A.IApi.PlaidLinkTokenExchangeRequest
  ): A.IApi.Request<A.IApi.PlaidLinkTokenExchangeResponse> {
    return {
      response: (async () => {
        const r = await plaidApi.exchangePublicToken(request)
        const {access_token, item_id} = r
        return {
          accessToken: access_token,
          itemId: item_id,
        }
      })(),
    }
  }

  function plaidLinkPlaidItemList(request: {}): A.IApi.Request<A.IApi.PlaidLinkPlaidItemListResponse> {
    return {
      response: (async () => {
        return {
          items: model.entities.PlaidItemConfig.byDisplayName.entitiesArray.map(
            (e) => {
              const {name, displayName, plaidItemId} = e
              return {
                name,
                displayName,
                plaidItemId,
              }
            }
          ),
        }
      })(),
    }
  }

  function modelEntityList(request: {}): A.IApi.Request<A.IApi.ModelEntityListResponse> {
    const model = A.AppModel.createModel()
    app.loadJournal({model, configName})
    const entities = [
      ...model.entities.SourceTransaction.all.entitiesArray,
      ...model.entities.Account.all.entitiesArray,
      ...model.entities.JournalEntry.all.entitiesArray,
      ...model.entities.JournalEntryAccount.all.entitiesArray,
    ]
    const entityJsons = entities.map((e) => e.toJSON())
    return {
      response: Promise.resolve({
        entities: entityJsons,
      }),
    }
  }

  return {
    plaidLink: {
      linkToken: {
        create: (request) => plaidLinkLinkTokenCreate(request),
        exchange: (request) => plaidLinkTokenExchange(request),
      },
      plaidItem: {
        list: (request) => plaidLinkPlaidItemList(request),
      },
    },
    model: {
      entity: {
        list: (request) => modelEntityList(request),
      },
    },
  }
}
