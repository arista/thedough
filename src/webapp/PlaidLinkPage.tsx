import {A, M} from "../lib/index.js"
import * as R from "react"
import * as RR from "react-router"
import * as Plaid from "react-plaid-link"
import * as V from "./views.js"

export const PlaidLinkPage = () => {
  const [token, setToken] = R.useState<string | null>(null)
  const [updateItemId, setUpdateItemId] = R.useState<string | undefined>(
    undefined
  )
  const api = V.useApi()

  R.useEffect(() => {
    ;(async () => {
      const result = await api.plaidLink.linkToken.create({
        updateItemId,
      }).response
      setToken(result.linkToken)
    })()
  }, [updateItemId])

  const onChangeUpdateItemId = (updateItemId: string | undefined) => {
    setUpdateItemId(updateItemId)
  }

  return (
    <div>
      <div id="plaid-link-page">This is the plaid link page</div>
      <ListPlaidItems onChangeUpdateItemId={onChangeUpdateItemId} />
      <RunPlaidLink token={token} />
    </div>
  )
}

const ListPlaidItems = ({
  onChangeUpdateItemId,
}: {
  onChangeUpdateItemId: (updateItemId: string | undefined) => void
}) => {
  const api = V.useApi()
  const [items, setItems] = R.useState<Array<A.IApi.PlaidItemInfo | null>>([
    null,
  ])
  const [selectedItem, setSelectedItem] =
    R.useState<A.IApi.PlaidItemInfo | null>(null)

  R.useEffect(() => {
    ;(async () => {
      const result = await api.plaidLink.plaidItem.list({}).response
      setItems([null, ...result.items])
    })()
  }, [])

  const onChange = (event: any) => {
    const selectedPlaidItemId = event.target.value
    if (selectedPlaidItemId === "") {
      setSelectedItem(null)
      onChangeUpdateItemId(undefined)
    } else {
      const item =
        items.find((i) => i != null && i.plaidItemId === selectedPlaidItemId) ??
        null
      setSelectedItem(item)
      onChangeUpdateItemId(item?.plaidItemId ?? undefined)
    }
  }

  return (
    <div>
      <select onChange={onChange}>
        {items.map((i) => (
          <ListPlaidItem
            key={i?.name || ""}
            item={i}
            selected={selectedItem === i}
          />
        ))}
      </select>
    </div>
  )
}

const ListPlaidItem = ({
  item,
  selected,
}: {
  item: A.IApi.PlaidItemInfo | null
  selected: boolean
}) => {
  if (item != null) {
    const {name, displayName, plaidItemId} = item
    return <option value={plaidItemId}>Update {displayName}</option>
  } else {
    return <option value="">Connect New Item</option>
  }
}

const RunPlaidLink = ({token}: {token: string | null}) => {
  const api = V.useApi()

  const onSuccess = R.useCallback<Plaid.PlaidLinkOnSuccess>(
    (publicToken, metadata) => {
      console.log(`onSuccess`, publicToken, metadata)
      ;(async () => {
        const result = await api.plaidLink.linkToken.exchange({publicToken})
          .response
        console.log(result)
      })()
    },
    []
  )

  const {open, ready} = Plaid.usePlaidLink({
    token,
    onSuccess,
  })

  return (
    <button onClick={() => open()} disabled={!ready}>
      Open Plaid Link
    </button>
  )
}
