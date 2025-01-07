import {A, M} from "../index.js"

export function readConfig({
  configFile,
  model,
}: {
  configFile: M.ConfigFile
  model: M.Model
}): M.entities.Config {
  const configModel = model.entities.Config.add({})

  const {plaidConfig} = configFile
  const {
    plaidClientId,
    plaidSecret,
    clientUserId,
    clientName,
    products,
    countryCodes,
    plaidItems,
  } = plaidConfig
  const plaidConfigModel = model.entities.PlaidConfig.add({
    configId: configModel.id,
    plaidClientId,
    plaidSecret,
    clientUserId,
    clientName,
    products,
    countryCodes,
  })

  for (const name of Object.keys(plaidItems)) {
    const plaidItem = plaidItems[name]
    const {displayName, plaidAccessToken, plaidItemId, accounts} = plaidItem
    const plaidItemModel = model.entities.PlaidItemConfig.add({
      plaidConfigId: plaidConfigModel.id,
      name,
      displayName,
      plaidAccessToken,
      plaidItemId,
    })

    for (const name of Object.keys(accounts)) {
      const account = accounts[name]
      const {displayName, plaidAccountId} = account
      const plaidAccountModel = model.entities.PlaidAccountConfig.add({
        plaidItemConfigId: plaidItemModel.id,
        plaidAccountId,
        name,
        displayName,
      })
    }
  }

  return configModel
}
