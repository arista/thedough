import * as RR from "react-router"

export const ErrorPage = () => {
  const error: any = RR.useRouteError()
  console.log(error)
  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>An error has occurred</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  )
}
