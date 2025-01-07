import * as R from "react"
import * as RR from "react-router-dom"

export const Root = () => {
  return (
    <div>
      <h1>Taterdough</h1>
      <nav>
        <ul>
          <li>
            <RR.Link to={`plaid-link`}>
              Use Plaid Link to link a new account
            </RR.Link>
          </li>
          <li>
            <RR.Link to={`journal`}>Review the journal</RR.Link>
          </li>
        </ul>
      </nav>
      <div id="detail">
        <RR.Outlet />
      </div>
    </div>
  )
}
