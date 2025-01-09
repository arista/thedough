import {A, M} from "../lib/index.js"

export class ClientApi {
  constructor(
    public props: {
      pathToWebRoot: string
    }
  ) {}

  toFullPath(path: string): string {
    return `${this.props.pathToWebRoot}${path}`
  }

  post<RQ, RS>(path: string, request: RQ): A.IApi.Request<RS> {
    const fullPath = this.toFullPath(path)
    return {
      response: (async () => {
        const r = await fetch(fullPath, {
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

  get<RQ, RS>(path: string): A.IApi.Request<RS> {
    const fullPath = this.toFullPath(path)
    return {
      response: (async () => {
        const r = await fetch(fullPath, {
          method: "GET",
        })
        return await r.json()
      })(),
    }
  }

  createApi(): M.IApi {
    return {
      plaidLink: {
        linkToken: {
          create: (request) => this.post(`api/plaidLink/linkToken`, request),
          exchange: (request) =>
            this.post(`api/plaidLink/linkToken/exchange`, request),
        },
        plaidItem: {
          list: (request) => this.get(`api/plaidLink/plaidItem`),
        },
      },
      model: {
        entity: {
          list: (request) => this.get(`api/model/entity`),
        },
      },
    }
  }
}
