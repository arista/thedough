import {A, M} from "../lib/index.js"

function apiPost<RQ, RS>(path: string, request: RQ): A.IApi.Request<RS> {
  return {
    response: (async () => {
      const r = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })
      return await r.json()
    })(),
  }
}

function apiGet<RQ, RS>(path: string): A.IApi.Request<RS> {
  return {
    response: (async () => {
      const r = await fetch(path, {
        method: "GET",
      })
      return await r.json()
    })(),
  }
}

export function createApi(): M.IApi {
  return {
    plaidLink: {
      linkToken: {
        create: (request) => apiPost(`api/plaidLink/linkToken`, request),
        exchange: (request) =>
          apiPost(`api/plaidLink/linkToken/exchange`, request),
      },
      plaidItem: {
        list: (request) => apiGet(`api/plaidLink/plaidItem`),
      },
    },
    model: {
      entity: {
        list: (request) => apiGet(`api/model/entity`),
      },
    },
  }
}
