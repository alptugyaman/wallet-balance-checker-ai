import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY
const COINGECKO_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY

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

// Axios instance for CoinGecko
const coingeckoApi = axios.create({
  baseURL: 'https://api.coingecko.com/api/v3',
  headers: {
    'x-cg-demo-api-key': COINGECKO_API_KEY
  }
});

// Axios instance for Moralis
const moralisApi = axios.create({
  baseURL: 'https://deep-index.moralis.io/api/v2',
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
  name: string
  symbol: string
  logo?: string
  thumbnail?: string
  decimals: string
  balance: string
  usdPrice: number
  totalValue: number
}

interface TopToken {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
}

function App() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [allBalances, setAllBalances] = useState<TokenBalance[]>([])
  const [showAll, setShowAll] = useState(false)
  const [totalValue, setTotalValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [topTokens, setTopTokens] = useState<Record<string, TopToken>>({})
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentAddresses, setRecentAddresses] = useState<string[]>([])
  const [marketDataLoading, setMarketDataLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

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

  // Market verilerini sırayla al
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await coingeckoApi.get('/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            page: currentPage,
            locale: 'en'
          }
        });

        // Token'ları biriktir
        setTopTokens(prevTokens => {
          const updatedTokens = { ...prevTokens };
          response.data.forEach((token: any) => {
            updatedTokens[token.id] = {
              id: token.id,
              symbol: token.symbol.toUpperCase(),
              name: token.name,
              current_price: token.current_price || 0,
              image: token.image
            };
          });
          return updatedTokens;
        });

        // 100ms bekle ve sonraki sayfaya geç
        if (currentPage < 10) {
          setTimeout(() => {
            setCurrentPage(prev => prev + 1);
          }, 100);
        } else {
          setMarketDataLoading(false);
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
        setTimeout(() => {
          setCurrentPage(prev => prev);
        }, 100);
      }
    };

    if (marketDataLoading && currentPage <= 10) {
      fetchMarketData();
    }
  }, [currentPage, marketDataLoading]);

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
      // ETH bakiyesi ve token bakiyelerini paralel al
      const [nativeBalance, tokenResponse] = await Promise.all([
        moralisApi.get(`/${address}/balance`, {
          params: {
            chain: 'eth'
          }
        }),
        moralisApi.get(`/${address}/erc20`, {
          params: {
            chain: 'eth'
          }
        })
      ])

      const balances: TokenBalance[] = []

      // Token bakiyelerini işle
      tokenResponse.data.forEach((token: any) => {
        // Symbol kontrolü
        if (!token.symbol) return;

        // CoinGecko'dan token'ı symbol'e göre bul
        const tokenInfo = Object.values(topTokens).find(t =>
          t.symbol.toLowerCase() === token.symbol.toLowerCase()
        )

        if (tokenInfo) {
          const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals))
          balances.push({
            ...token,
            usdPrice: tokenInfo.current_price || 0,
            balance: balance.toString(),
            totalValue: balance * (tokenInfo.current_price || 0),
            thumbnail: tokenInfo.image || token.thumbnail
          })
        }
      })

      // ETH bakiyesini ekle
      const ethBalance = parseFloat(nativeBalance.data.balance) / 1e18
      const ethInfo = Object.values(topTokens).find(t => t.symbol?.toLowerCase() === 'eth')
      if (ethInfo) {
        balances.push({
          token_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          name: ethInfo.name,
          symbol: ethInfo.symbol,
          decimals: '18',
          balance: ethBalance.toString(),
          usdPrice: ethInfo.current_price,
          totalValue: ethBalance * ethInfo.current_price,
          thumbnail: ethInfo.image
        })
      }

      // USD değerine göre sırala
      const sortedBalances = balances.sort((a, b) => b.totalValue - a.totalValue)

      // Tüm token'ları sakla
      setAllBalances(sortedBalances)

      // Sadece 10 dolar üzeri değeri olan token'ları göster
      const filteredBalances = sortedBalances.filter(token => token.totalValue >= 10)
      setBalances(filteredBalances)

      const total = sortedBalances.reduce((acc, token) => acc + token.totalValue, 0)
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

  // Gösterilecek token'ları belirle
  const displayedBalances = showAll ? allBalances : balances

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
        ) : displayedBalances.length > 0 ? (
          <div className="bg-[#1E2028] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-800">
                  <th className="text-left p-4">Token</th>
                  <th className="text-right p-4">Price</th>
                  <th className="text-right p-4">Amount</th>
                  <th className="text-right p-4">USD Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {displayedBalances.map((token) => (
                  <tr key={token.token_address} className="hover:bg-gray-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {token.thumbnail && (
                          <img src={token.thumbnail} alt={token.name} className="w-8 h-8 rounded-full bg-gray-800" />
                        )}
                        <span className="font-medium">{token.symbol}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      ${token.usdPrice.toFixed(4)}
                    </td>
                    <td className="p-4 text-right">
                      {formatAmount(parseFloat(token.balance))}
                    </td>
                    <td className="p-4 text-right">
                      {formatMoney(token.totalValue)}
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
