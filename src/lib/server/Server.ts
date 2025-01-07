import {A, M} from "../index.js"
import express from "express"
import Path from "node:path"
import http from "node:http"

export interface Props {
  app: M.App
  port: number
  configName: string
}

export class Server {
  _app: express.Express
  _server: http.Server | null = null

  constructor(public props: Props) {
    this._app = express()
    const {app, configName} = this.props
    const {plaidApi, model} = app
    const api = M.createServerApi({app, configName})

    this._app.use(express.json())

    // Set up the api
    this._app.use(
      "/api",
      createRouter((r) => {
        r.use(
          "/plaidLink",
          createRouter((r) => {
            r.post("/linkToken", async (req, res) => {
              res.send(await api.plaidLink.linkToken.create(req.body).response)
            })
            r.post("/linkToken/exchange", async (req, res) => {
              res.send(
                await api.plaidLink.linkToken.exchange(req.body).response
              )
            })
            r.get("/plaidItem", async (req, res) => {
              res.send(await api.plaidLink.plaidItem.list({}).response)
            })
          })
        )
        r.use(
          "/model",
          createRouter((r) => {
            r.get("/entity", async (req, res) => {
              res.send(await api.model.entity.list({}).response)
            })
          })
        )
      })
    )

    // public/html and the build/webapp directories are effectively
    // merged into a single directory, to handle url's to js/,
    // images/, style/, ...
    const staticDirs = ["build/webapp", "src/lib/server/public/html"]
    staticDirs.forEach((d) => {
      const root = Path.join(A.Utils.getPackageDirectory(), d)
      this._app.use(express.static(root, {redirect: false}))
    })

    // All other URL's should serve the main page for the single-page
    // app, and let react router handle the URL
    this._app.use("/", (req, res) => this.renderSPAPage(req, res))
  }

  // Render the main page.  From the URL,
  // render a relative link to the
  renderSPAPage(req: express.Request, res: express.Response) {
    const pathToRoot = getPathToRoot(req.path)
    const page = `<html>
  <head>
    <script language="javascript">const pathToRoot = "${pathToRoot}";</script>
    <script language="javascript" src="${pathToRoot}js/webapp.js"></script>
    <link rel="stylesheet" href="${pathToRoot}styles/webapp.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`
    res.send(page)
  }

  async start(): Promise<void> {
    const server = await this._app.listen(this.props.port)
    this._server = server
  }

  async shutdown(): Promise<void> {
    const server = this._server
    if (server != null) {
      await new Promise((resolve) => server.close(resolve))
    }
  }
}

export function getPathToRoot(path: string): string {
  if (path.startsWith("/")) {
    path = path.substring(1)
  }
  let ret = ""
  for (const c of path) {
    if (c === "/") {
      ret += "../"
    }
  }
  return ret
}

export function createRouter(
  f: (router: express.Router) => void
): express.Router {
  const router = express.Router()
  f(router)
  return router
}
