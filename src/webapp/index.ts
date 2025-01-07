import {createRoot} from "react-dom/client"
import {Webapp} from "./Webapp.js"

document.addEventListener("DOMContentLoaded", () => {
  const webapp = new Webapp({})
  const rootElem = document.getElementById("root")
  if (rootElem == null) throw new Error(`No element found with id "root"`)
  createRoot(rootElem).render(webapp.render())
})
