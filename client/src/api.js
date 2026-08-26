const BASE = '/api'

function getToken() {
  return localStorage.getItem('auth_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const getConfig      = ()     => request('/config')
export const loginTelegram  = (data) => request('/auth/telegram', { method: 'POST', body: JSON.stringify(data) })

export const getLedgers    = ()     => request('/ledgers')
export const createLedger  = (data) => request('/ledgers', { method: 'POST', body: JSON.stringify(data) })
export const deleteLedger  = (id)   => request(`/ledgers/${id}`, { method: 'DELETE' })

export const getEntries    = ()     => request('/entries')
export const createEntry   = (data) => request('/entries', { method: 'POST', body: JSON.stringify(data) })
export const updateEntry   = (id, data) => request(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteEntry   = (id)   => request(`/entries/${id}`, { method: 'DELETE' })

export const getCategories    = (ledgerId) => request(ledgerId ? `/categories?ledger_id=${ledgerId}` : '/categories')
export const createCategory   = (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) })
export const deleteCategory   = (id)   => request(`/categories/${id}`, { method: 'DELETE' })

export const getWallets              = ()         => request('/wallets')
export const createWallet            = (data)     => request('/wallets', { method: 'POST', body: JSON.stringify(data) })
export const updateWallet            = (id, data) => request(`/wallets/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteWallet            = (id)       => request(`/wallets/${id}`, { method: 'DELETE' })
export const saveWalletCredentials   = (id, data) => request(`/wallets/${id}/credentials`, { method: 'PUT', body: JSON.stringify(data) })
export const getWalletLiveBalance    = (id)       => request(`/wallets/${id}/live-balance`)
export const getExchanges            = ()         => request('/exchanges')
export const getExchangeRates        = ({ target, sources }) => {
  const params = new URLSearchParams({
    target,
    sources: [...new Set(sources)].join(','),
  })
  return request(`/exchange-rates?${params}`)
}
