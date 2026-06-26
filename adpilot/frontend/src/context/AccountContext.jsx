import { createContext, useContext, useState } from 'react'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const [accountId, setAccountId] = useState(null)
  const [accountName, setAccountName] = useState(null)
  const [platform, setPlatform] = useState('all')

  function selectAccount(id, name) {
    setAccountId(id || null)
    setAccountName(name || null)
  }

  function selectPlatform(p) {
    setPlatform(p)
    setAccountId(null)
    setAccountName(null)
  }

  return (
    <AccountContext.Provider value={{ accountId, accountName, platform, selectAccount, selectPlatform }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
