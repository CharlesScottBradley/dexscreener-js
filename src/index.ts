/**
 * DexScreener API Client
 * TypeScript client for fetching token prices, pairs, and metrics across multiple chains
 *
 * API Docs: https://docs.dexscreener.com/api/reference
 */

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest'
const DEXSCREENER_TOKEN_BOOSTS = 'https://api.dexscreener.com/token-boosts/top/v1'

// Chain ID mappings
const CHAIN_MAP: Record<string, string> = {
  'SOL': 'solana',
  'ETH': 'ethereum',
  'BASE': 'base',
  'ARB': 'arbitrum',
  'BSC': 'bsc',
  'AVAX': 'avalanche',
  'MATIC': 'polygon',
  'FTM': 'fantom',
  'OP': 'optimism',
}

/**
 * Normalize chain identifier to DexScreener format
 */
function normalizeChain(chain: string): string {
  return CHAIN_MAP[chain.toUpperCase()] || chain.toLowerCase()
}

// ============================================================================
// Types
// ============================================================================

export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceNative: string
  priceUsd: string
  txns: {
    m5: { buys: number; sells: number }
    h1: { buys: number; sells: number }
    h6: { buys: number; sells: number }
    h24: { buys: number; sells: number }
  }
  volume: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  priceChange: {
    m5: number
    h1: number
    h6: number
    h24: number
  }
  liquidity: {
    usd: number
    base: number
    quote: number
  }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: {
    imageUrl?: string
    websites?: { label: string; url: string }[]
    socials?: { type: string; url: string }[]
  }
}

export interface DexScreenerBoostedToken {
  url: string
  chainId: string
  tokenAddress: string
  icon?: string
  description?: string
  links?: Array<{ type: string; label: string; url: string }>
  amount: number
  totalAmount: number
}

export interface TokenMetrics {
  ticker: string
  name: string
  chain: string
  contract: string
  priceUsd: number
  priceChange24h: number
  volume24h: number
  liquidity: number
  marketCap: number
  fdv: number
  pairUrl: string
  dex: string
  imageUrl?: string
  fetchedAt: Date
}

export interface TokenSocials {
  twitter?: string
  telegram?: string
  discord?: string
  website?: string
}

export interface SearchOptions {
  /** Minimum 24h volume in USD */
  minVolume?: number
  /** Filter by chain */
  chain?: string
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Search for tokens by ticker symbol or name
 * Returns the most liquid pair found
 *
 * @example
 * ```ts
 * const pair = await searchToken('BONK')
 * console.log(pair?.priceUsd)
 * ```
 */
export async function searchToken(query: string): Promise<DexScreenerPair | null> {
  try {
    const url = `${DEXSCREENER_BASE}/dex/search?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`)
    }

    const data = await response.json()
    const pairs: DexScreenerPair[] = data.pairs || []

    if (pairs.length === 0) return null

    // Return the pair with highest liquidity
    return pairs.reduce((best, pair) => {
      const bestLiq = best.liquidity?.usd || 0
      const pairLiq = pair.liquidity?.usd || 0
      return pairLiq > bestLiq ? pair : best
    }, pairs[0])

  } catch (error) {
    console.error(`DexScreener search error for ${query}:`, error)
    return null
  }
}

/**
 * Get token info by contract address
 *
 * @example
 * ```ts
 * const pair = await getTokenByAddress('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
 * console.log(pair?.baseToken.name) // "Bonk"
 * ```
 */
export async function getTokenByAddress(
  chain: string,
  address: string
): Promise<DexScreenerPair | null> {
  try {
    const chainId = normalizeChain(chain)
    const url = `${DEXSCREENER_BASE}/dex/tokens/${address}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`)
    }

    const data = await response.json()
    const pairs: DexScreenerPair[] = data.pairs || []

    if (pairs.length === 0) return null

    // Filter by chain if specified, then return highest liquidity
    const filteredPairs = chainId
      ? pairs.filter(p => p.chainId === chainId)
      : pairs

    if (filteredPairs.length === 0) {
      return pairs[0] // Fallback to any chain
    }

    return filteredPairs.reduce((best, pair) => {
      const bestLiq = best.liquidity?.usd || 0
      const pairLiq = pair.liquidity?.usd || 0
      return pairLiq > bestLiq ? pair : best
    }, filteredPairs[0])

  } catch (error) {
    console.error(`DexScreener fetch error for ${chain}:${address}:`, error)
    return null
  }
}

/**
 * Get token metrics in a simplified format
 *
 * @example
 * ```ts
 * const metrics = await getTokenMetrics('BONK', 'solana')
 * console.log(metrics?.marketCap)
 * ```
 */
export async function getTokenMetrics(
  ticker: string,
  chain?: string
): Promise<TokenMetrics | null> {
  const query = chain ? `${ticker} ${chain}` : ticker
  const pair = await searchToken(query)

  if (!pair) return null

  // Verify the symbol matches (DexScreener search is fuzzy)
  if (pair.baseToken.symbol.toUpperCase() !== ticker.toUpperCase()) {
    const retryPair = await searchToken(ticker)
    if (!retryPair || retryPair.baseToken.symbol.toUpperCase() !== ticker.toUpperCase()) {
      return null
    }
    return pairToMetrics(retryPair)
  }

  return pairToMetrics(pair)
}

/**
 * Convert DexScreener pair to TokenMetrics format
 */
export function pairToMetrics(pair: DexScreenerPair): TokenMetrics {
  return {
    ticker: pair.baseToken.symbol,
    name: pair.baseToken.name,
    chain: pair.chainId.toUpperCase(),
    contract: pair.baseToken.address,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    volume24h: pair.volume?.h24 || 0,
    liquidity: pair.liquidity?.usd || 0,
    marketCap: pair.marketCap || pair.fdv || 0,
    fdv: pair.fdv || 0,
    pairUrl: pair.url,
    dex: pair.dexId,
    imageUrl: pair.info?.imageUrl,
    fetchedAt: new Date(),
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch fetch multiple tokens by addresses (up to 30 per call)
 * Uses DexScreener's multi-token endpoint for efficiency
 *
 * @example
 * ```ts
 * const tokens = await getTokensByAddresses([
 *   'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
 *   'So11111111111111111111111111111111111111112'
 * ], 'solana')
 * ```
 */
export async function getTokensByAddresses(
  addresses: string[],
  chainFilter?: string
): Promise<Map<string, DexScreenerPair>> {
  const results = new Map<string, DexScreenerPair>()

  if (addresses.length === 0) return results

  const normalizedChain = chainFilter ? normalizeChain(chainFilter) : null
  const BATCH_SIZE = 30
  const batches: string[][] = []

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    batches.push(addresses.slice(i, i + BATCH_SIZE))
  }

  for (const batch of batches) {
    try {
      const addressList = batch.join(',')
      const url = `${DEXSCREENER_BASE}/dex/tokens/${addressList}`

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) continue

      const data = await response.json()
      const pairs: DexScreenerPair[] = data.pairs || []

      // Group pairs by base token address
      const pairsByAddress = new Map<string, DexScreenerPair[]>()

      for (const pair of pairs) {
        if (normalizedChain && pair.chainId !== normalizedChain) continue

        const addr = pair.baseToken.address
        const existing = pairsByAddress.get(addr) || []
        existing.push(pair)
        pairsByAddress.set(addr, existing)
      }

      // Pick highest liquidity pair for each address
      for (const [addr, tokenPairs] of pairsByAddress) {
        const bestPair = tokenPairs.reduce((best, pair) => {
          const bestLiq = best.liquidity?.usd || 0
          const pairLiq = pair.liquidity?.usd || 0
          return pairLiq > bestLiq ? pair : best
        }, tokenPairs[0])

        results.set(addr, bestPair)
      }

      // Rate limit between batches
      if (batches.length > 1) {
        await new Promise(r => setTimeout(r, 100))
      }

    } catch (error) {
      console.error('DexScreener batch fetch error:', error)
    }
  }

  return results
}

/**
 * Batch fetch metrics for multiple tokens with rate limiting
 *
 * @example
 * ```ts
 * const metrics = await batchGetMetrics([
 *   { ticker: 'BONK', chain: 'solana' },
 *   { ticker: 'PEPE', chain: 'ethereum' }
 * ])
 * ```
 */
export async function batchGetMetrics(
  tokens: Array<{ ticker: string; chain?: string; contract?: string }>
): Promise<Map<string, TokenMetrics>> {
  const results = new Map<string, TokenMetrics>()

  for (const token of tokens) {
    if (token.contract && token.chain) {
      const pair = await getTokenByAddress(token.chain, token.contract)
      if (pair) {
        results.set(token.ticker, pairToMetrics(pair))
      }
    } else {
      const metrics = await getTokenMetrics(token.ticker, token.chain)
      if (metrics) {
        results.set(token.ticker, metrics)
      }
    }

    // Rate limit: ~4 requests per second
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return results
}

// ============================================================================
// Discovery & Trending
// ============================================================================

/**
 * Get boosted tokens (promoted tokens on DexScreener)
 *
 * @example
 * ```ts
 * const boosted = await getBoostedTokens()
 * console.log(boosted[0]?.tokenAddress)
 * ```
 */
export async function getBoostedTokens(): Promise<DexScreenerBoostedToken[]> {
  try {
    const response = await fetch(DEXSCREENER_TOKEN_BOOSTS, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`)
    }

    return await response.json() || []
  } catch (error) {
    console.error('DexScreener boosted tokens error:', error)
    return []
  }
}

/**
 * Get new trading pairs for a specific chain
 *
 * @example
 * ```ts
 * const newPairs = await getNewPairs('solana')
 * console.log(newPairs[0]?.baseToken.name)
 * ```
 */
export async function getNewPairs(chainId: string): Promise<DexScreenerPair[]> {
  try {
    const normalizedChainId = normalizeChain(chainId)
    const url = `${DEXSCREENER_BASE}/dex/pairs/${normalizedChainId}`

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`)
    }

    const data = await response.json()
    const pairs: DexScreenerPair[] = data.pairs || []

    // Sort by creation date (newest first)
    return pairs.sort((a, b) => b.pairCreatedAt - a.pairCreatedAt)
  } catch (error) {
    console.error(`DexScreener new pairs error for ${chainId}:`, error)
    return []
  }
}

/**
 * Search tokens with volume filtering
 *
 * @example
 * ```ts
 * const pairs = await searchByVolume('meme', 50000) // min $50k volume
 * ```
 */
export async function searchByVolume(
  query: string,
  minVolume24h: number = 30000
): Promise<DexScreenerPair[]> {
  try {
    const url = `${DEXSCREENER_BASE}/dex/search?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`)
    }

    const data = await response.json()
    const pairs: DexScreenerPair[] = data.pairs || []

    return pairs
      .filter((pair) => (pair.volume?.h24 || 0) >= minVolume24h)
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
  } catch (error) {
    console.error(`DexScreener volume search error for ${query}:`, error)
    return []
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract social links from a DexScreener pair
 *
 * @example
 * ```ts
 * const pair = await searchToken('BONK')
 * const socials = extractSocials(pair!)
 * console.log(socials.twitter)
 * ```
 */
export function extractSocials(pair: DexScreenerPair): TokenSocials {
  const socials: TokenSocials = {}

  if (pair.info?.socials) {
    for (const social of pair.info.socials) {
      const type = social.type.toLowerCase()
      if (type === 'twitter') socials.twitter = social.url
      if (type === 'telegram') socials.telegram = social.url
      if (type === 'discord') socials.discord = social.url
    }
  }

  if (pair.info?.websites?.[0]?.url) {
    socials.website = pair.info.websites[0].url
  }

  return socials
}

/**
 * Get the primary liquidity pool address for a token
 *
 * @example
 * ```ts
 * const lpAddress = await getLiquidityPoolAddress('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
 * ```
 */
export async function getLiquidityPoolAddress(
  chain: string,
  tokenAddress: string
): Promise<string | null> {
  const pair = await getTokenByAddress(chain, tokenAddress)
  return pair?.pairAddress || null
}

/**
 * Get all liquidity pool addresses for a token (tokens can have multiple pools)
 *
 * @example
 * ```ts
 * const lpAddresses = await getAllLiquidityPoolAddresses('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
 * ```
 */
export async function getAllLiquidityPoolAddresses(
  chain: string,
  tokenAddress: string
): Promise<string[]> {
  try {
    const chainId = normalizeChain(chain)
    const url = `${DEXSCREENER_BASE}/dex/tokens/${tokenAddress}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) return []

    const data = await response.json()
    const pairs: DexScreenerPair[] = data.pairs || []

    return pairs
      .filter(p => p.chainId === chainId)
      .map(p => p.pairAddress)
      .filter((addr, idx, arr) => arr.indexOf(addr) === idx)

  } catch (error) {
    console.error(`Error fetching LP addresses for ${tokenAddress}:`, error)
    return []
  }
}

// ============================================================================
// Default Export - Client Class
// ============================================================================

/**
 * DexScreener API client class for object-oriented usage
 *
 * @example
 * ```ts
 * const dex = new DexScreener()
 * const bonk = await dex.search('BONK')
 * const metrics = await dex.getMetrics('PEPE', 'ethereum')
 * ```
 */
export class DexScreener {
  search = searchToken
  getByAddress = getTokenByAddress
  getMetrics = getTokenMetrics
  getBoosted = getBoostedTokens
  getNewPairs = getNewPairs
  searchByVolume = searchByVolume
  batchGetByAddresses = getTokensByAddresses
  batchGetMetrics = batchGetMetrics
  extractSocials = extractSocials
  getLPAddress = getLiquidityPoolAddress
  getAllLPAddresses = getAllLiquidityPoolAddresses
  pairToMetrics = pairToMetrics
}

export default DexScreener
