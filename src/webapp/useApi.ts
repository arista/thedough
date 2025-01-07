import {A, M} from "../lib/index.js"
import * as R from "react"
import * as V from "./views.js"
import * as Webapp from "./Webapp.js"

export function useApi(): M.IApi {
  const api: M.IApi | null = R.useContext(Webapp.ApiContext)
  return A.Utils.notNull(api)
}
