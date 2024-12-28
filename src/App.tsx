import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY

// Para birimi formatı için
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Token miktarı formatı için
const formatAmount = (amount: number) => {
  if (amount === 0) return '0'
  if (amount < 0.0001) return amount.toExponential(4)
  if (amount < 1) return amount.toPrecision(4)
  if (amount < 1000) return amount.toFixed(4)
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(amount)
}

// Axios instance for Moralis
const moralisApi = axios.create({
  baseURL: 'https://deep-index.moralis.io/api/v2.2',
  headers: {
    'X-API-Key': MORALIS_API_KEY
  }
});

const isValidEthereumAddress = (address: string) => {
  if (!address) return false
  if (!/^0x[a-fA-F0-9]+$/.test(address)) return false
  return address.length === 42
}

interface TokenBalance {
  token_address: string
  symbol: string
  name: string
  logo?: string
  thumbnail?: string
  decimals: number
  balance: string
  balance_formatted: string
  possible_spam: boolean
  verified_contract: boolean
  usd_price: number
  usd_value: number
  native_token: boolean
  portfolio_percentage: number
  usd_price_24hr_percent_change: number
  usd_price_24hr_usd_change: number
}

function App() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [allBalances, setAllBalances] = useState<TokenBalance[]>([])
  const [showAll, setShowAll] = useState(false)
  const [totalValue, setTotalValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentAddresses, setRecentAddresses] = useState<string[]>([])

  // Click-outside handler için ref
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Recent addresses'i local storage'dan al
  useEffect(() => {
    const saved = localStorage.getItem('recentAddresses')
    if (saved) {
      setRecentAddresses(JSON.parse(saved))
    }
  }, [])

  // Yeni adresi recent addresses'e ekle
  const addToRecent = (newAddress: string) => {
    const updated = [
      newAddress,
      ...recentAddresses.filter(addr => addr !== newAddress)
    ].slice(0, 5) // Son 5 adresi tut
    setRecentAddresses(updated)
    localStorage.setItem('recentAddresses', JSON.stringify(updated))
  }

  const fetchBalances = async () => {
    if (!address) {
      setError('Lütfen bir cüzdan adresi girin')
      return
    }

    if (!MORALIS_API_KEY) {
      setError('Moralis API anahtarı bulunamadı!')
      return
    }

    if (!isValidEthereumAddress(address)) {
      setError('Geçersiz Ethereum adresi! Adres 0x ile başlamalı ve 42 karakter uzunluğunda olmalıdır.')
      return
    }

    // Adresi recent'a ekle
    addToRecent(address)

    setLoading(true)
    setError(null)
    setBalances([])
    setAllBalances([])
    setShowAll(false)

    try {
      const response = await moralisApi.get(`/wallets/${address}/tokens`, {
        params: {
          chain: '0x1'
        }
      })

      console.log('API Response:', response.data)

      // Spam olmayan ve değeri olan token'ları filtrele
      const validTokens = response.data.result.filter((token: TokenBalance) =>
        !token.possible_spam && token.usd_value > 0
      )

      // USD değerine göre sırala
      const sortedBalances = validTokens.sort((a: TokenBalance, b: TokenBalance) => b.usd_value - a.usd_value)

      // Tüm token'ları sakla
      setAllBalances(sortedBalances)

      // Sadece 10 dolar üzeri değeri olan token'ları göster
      const filteredBalances = sortedBalances.filter((token: TokenBalance) => token.usd_value >= 10)
      setBalances(filteredBalances)

      const total = sortedBalances.reduce((acc: number, token: TokenBalance) => acc + token.usd_value, 0)
      setTotalValue(total)
    } catch (error: any) {
      console.error('Error fetching balances:', error)
      let errorMessage = 'Veri çekilirken bir hata oluştu'

      if (error.response?.status === 429) {
        errorMessage = 'API istek limiti aşıldı. Lütfen biraz bekleyip tekrar deneyin.'
      } else {
        errorMessage = error.response?.data?.message || error.message || errorMessage
      }

      setError(`Hata: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#13141b] text-white p-8 flex items-center justify-center">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-8">
          <p className="text-xl text-gray-400 italic mb-2">"Not your keys, not your coins."</p>
          <p className="text-sm text-gray-500">Always ensure your wallet security and never share your private keys.</p>
        </div>
        <div className="mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative" ref={dropdownRef}>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Enter EVM wallet address (0x...)"
                className="w-full px-4 py-3 bg-[#1E2028] border border-gray-700/50 rounded-lg focus:outline-none focus:border-blue-500"
              />
              {showSuggestions && recentAddresses.length > 0 && (
                <div className="absolute w-full mt-1 bg-[#1E2028] border border-gray-700/50 rounded-lg overflow-hidden z-10">
                  {recentAddresses.map((addr) => (
                    <button
                      key={addr}
                      onClick={() => {
                        setAddress(addr)
                        setShowSuggestions(false)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-800/30 transition-colors"
                    >
                      {addr}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={fetchBalances}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Loading...' : 'Check Balance'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400">Loading...</div>
        ) : balances.length > 0 ? (
          <div className="bg-[#1E2028] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-800">
                  <th className="text-left p-4">Token</th>
                  <th className="text-right p-4">Price</th>
                  <th className="text-right p-4">Amount</th>
                  <th className="text-right p-4">USD Value</th>
                  <th className="text-right p-4">24h Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(showAll ? allBalances : balances).map((token) => (
                  <tr key={token.token_address} className="hover:bg-gray-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {token.thumbnail ? (
                          <img src={token.thumbnail} alt={token.name} className="w-8 h-8 rounded-full bg-gray-800" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold">
                            {token.symbol.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium">{token.symbol}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      ${token.usd_price.toFixed(4)}
                    </td>
                    <td className="p-4 text-right">
                      {formatAmount(parseFloat(token.balance_formatted))}
                    </td>
                    <td className="p-4 text-right">
                      {formatMoney(token.usd_value)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`${token.usd_price_24hr_percent_change > 0
                            ? 'text-green-400'
                            : token.usd_price_24hr_percent_change < 0
                              ? 'text-red-400'
                              : ''
                          }`}>
                          {token.usd_price_24hr_percent_change > 0 ? '+' : ''}{token.usd_price_24hr_percent_change?.toFixed(2)}%
                        </span>
                        <span className={`text-sm ${token.usd_price_24hr_usd_change > 0
                            ? 'text-green-400'
                            : token.usd_price_24hr_usd_change < 0
                              ? 'text-red-400'
                              : ''
                          }`}>
                          {token.usd_price_24hr_usd_change > 0 ? '+' : ''}{formatMoney(token.usd_price_24hr_usd_change)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-gray-800 text-sm text-gray-500 flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  {showAll ? 'Showing all tokens' : 'Tokens with small balances are not displayed.'}
                </div>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {showAll ? 'Hide small balances' : 'Show all'}
                </button>
              </div>
              <div className="mt-4 text-[16px] text-white">
                Total Value: {formatMoney(totalValue)}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
