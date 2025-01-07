import {A, M} from "../index.js"

export function createAccounts(
  model: M.Model,
  chartOfAccounts: Array<A.JournalConfig.Account>
) {
  const accounts: Array<A.Model.entities.Account> = []
  for (let i = 0; i < chartOfAccounts.length; i++) {
    accounts.push(createAccount(model, chartOfAccounts[i], i))
  }

  // Now assign the parent hierarchy.  Do this by repeatedly going
  // through the list of accounts that haven't been assigned parents
  // and trying to assign them.  We need to do this repeatedly because
  // accounts might refer to ancestors that have not yet been assigned
  // into the hierarchy.  If we do make a pass that doesn't result in
  // any changes, then any left over accounts are still ambiguous

  const unparented = new Set<A.Model.entities.Account>(accounts)

  while (true) {
    let foundAtLeastOne = false
    const unparentedList = [...unparented]
    for (const account of unparentedList) {
      const {parentName} = account
      if (parentName == null) {
        unparented.delete(account)
        foundAtLeastOne = true
      } else {
        const parentAccount = findAccount(model, parentName)
        if (parentAccount != null) {
          account.parent = parentAccount
          unparented.delete(account)
          foundAtLeastOne = true
        }
      }
    }
    if (!foundAtLeastOne) break
  }

  if (unparented.size > 0) {
    for (const account of unparented) {
      const {name, parentName} = account
      console.log(
        `Account "${name}" specifies ambiguous or non-existent parent "${parentName}"`
      )
    }
    throw new Error(
      `Unable to construct the Chart of Accounts becuse of the previous errors`
    )
  }
}

export function createAccount(
  model: M.Model,
  accountConfig: A.JournalConfig.Account,
  order: number
): A.Model.entities.Account {
  const {id, parent, name, displayName, creditOrDebit, description} =
    accountConfig
  return model.entities.Account.add({
    id,
    parentName: parent,
    name,
    displayName: displayName ?? name,
    creditOrDebit,
    description,
    order,
  })
}

// Attempts to find an account with the given name.  It is possible
// for multiple accounts to have the same name, in which case they
// must be disambiguated to providing at least one ancestor name, such
// as "Revenue/Paycheck".  Note that "Revenue" doesn't have to be the
// direct parent of "Paycheck", just an ancestor.
export function findAccount(
  model: M.Model,
  name: string
): A.Model.entities.Account | null {
  const nameParts = name.split("/")
  const lastPart = nameParts[nameParts.length - 1]
  const remainingParts = nameParts.slice(0, nameParts.length - 1)
  const possible = model.entities.Account.byName.tryGet(lastPart)?.entitiesArray
  if (possible == null) {
    return null
  } else if (possible.length === 1) {
    const account = possible[0]
    if (matchesAccount(model, account, remainingParts)) {
      return account
    } else {
      return null
    }
  } else {
    // Try all the possibilities to see if only one matches
    const matches: Array<A.Model.entities.Account> = []
    for (const account of possible) {
      if (matchesAccount(model, account, remainingParts)) {
        matches.push(account)
      }
    }
    if (matches.length === 1) {
      return matches[0]
    } else {
      return null
    }
  }
}

export function matchesAccount(
  model: M.Model,
  account: A.Model.entities.Account,
  nameParts: Array<string>
): boolean {
  if (nameParts.length === 0) {
    return true
  }
  const lastPart = nameParts[nameParts.length - 1]
  const remainingParts = nameParts.slice(0, nameParts.length - 1)
  for (
    let ancestor = account.parent;
    ancestor != null;
    ancestor = ancestor.parent
  ) {
    if (ancestor.name === lastPart) {
      return matchesAccount(
        model,
        ancestor,
        nameParts.slice(0, nameParts.length - 1)
      )
    }
  }
  return false
}

export function printAccounts(model: M.Model) {
  console.log(`Chart of Accounts`)
  const topLevel = topLevelAccounts(model)
  for (const account of topLevel) {
    _printAccounts(model, account, "  ")
  }
}

export function topLevelAccounts(
  model: M.Model
): Array<A.Model.entities.Account> {
  return (
    model.entities.Account.byParentName.tryGet(null)?.inOrder?.entitiesArray ??
    []
  )
}

export function _printAccounts(
  model: M.Model,
  account: A.Model.entities.Account,
  indent: string
) {
  console.log(`${indent}${account.name}`)
  const childIndent = `${indent}  `
  const children = account.children
  if (children != null) {
    for (const child of children.inOrder.entities) {
      _printAccounts(model, child, childIndent)
    }
  }
}

// Check that all the configured Plaid accounts have unambiguous Account names
export function checkPlaidAccounts(model: M.Model) {
  let hasError = false
  for (const plaidAccount of model.entities.PlaidAccountConfig.all.entities) {
    const {name} = plaidAccount
    const accounts =
      model.entities.Account.byName.tryGet(name)?.entitiesArray ?? []
    if (accounts.length !== 1) {
      console.log(
        `Configured Plaid account ${name} does not have an existing, unambiguous corresponding Account in the Chart of Accounts`
      )
      hasError = true
    }
  }
  if (hasError) {
    throw new Error(
      `Missing Plaid accounts in the Chart of Accounts - see above messages`
    )
  }
}
