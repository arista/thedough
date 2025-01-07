import {A, M} from "../lib/index.js"
import * as R from "react"
import * as RR from "react-router-dom"
import * as V from "./views.js"
import {createApi} from "./ClientApi.js"

export class Webapp {
  constructor(props: {}) {}

  router = this.createRouter()
  api = createApi()

  createRouter() {
    return RR.createBrowserRouter([
      {
        path: "/",
        element: <V.Root />,
        errorElement: <V.ErrorPage />,
        children: [
          {
            path: "plaid-link",
            element: <V.PlaidLinkPage />,
          },
          {
            path: "journal",
            element: <V.JournalPage />,
          },
        ],
      },
    ])
  }

  render(): R.ReactElement {
    return (
      <R.StrictMode>
        <ApiContext.Provider value={this.api}>
          <RR.RouterProvider router={this.router} />
        </ApiContext.Provider>
      </R.StrictMode>
    )
  }
}

export const ApiContext = R.createContext<M.IApi | null>(null)
