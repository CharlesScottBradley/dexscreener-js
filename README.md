# dexscreener-js

TypeScript client for the [DexScreener API](https://docs.dexscreener.com/api/reference). Fetch token prices, trading pairs, and market metrics across multiple chains.

## Installation

```bash
npm install dexscreener-js
```

## Quick Start

```typescript
import { searchToken, getTokenByAddress, getTokenMetrics } from 'dexscreener-js'

// Search by ticker
const bonk = await searchToken('BONK')
console.log(bonk?.priceUsd)

// Get by contract address
const pair = await getTokenByAddress('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
console.log(pair?.baseToken.name) // "Bonk"

// Get simplified metrics
const metrics = await getTokenMetrics('PEPE', 'ethereum')
console.log(metrics?.marketCap)
```

### Class-based Usage

```typescript
import DexScreener from 'dexscreener-js'

const dex = new DexScreener()

const bonk = await dex.search('BONK')
const metrics = await dex.getMetrics('PEPE', 'ethereum')
const boosted = await dex.getBoosted()
```

## API Reference

### Core Functions

#### `searchToken(query: string)`
Search for tokens by ticker symbol or name. Returns the most liquid pair.

```typescript
const pair = await searchToken('BONK')
// Returns: DexScreenerPair | null
```

#### `getTokenByAddress(chain: string, address: string)`
Get token info by contract address.

```typescript
const pair = await getTokenByAddress('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
// Returns: DexScreenerPair | null
```

#### `getTokenMetrics(ticker: string, chain?: string)`
Get token metrics in a simplified format.

```typescript
const metrics = await getTokenMetrics('BONK', 'solana')
// Returns: TokenMetrics | null
```

### Batch Operations

#### `getTokensByAddresses(addresses: string[], chainFilter?: string)`
Batch fetch multiple tokens by addresses (up to 30 per call).

```typescript
const tokens = await getTokensByAddresses([
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'So11111111111111111111111111111111111111112'
], 'solana')
// Returns: Map<string, DexScreenerPair>
```

#### `batchGetMetrics(tokens: Array<{ticker, chain?, contract?}>)`
Batch fetch metrics with built-in rate limiting.

```typescript
const metrics = await batchGetMetrics([
  { ticker: 'BONK', chain: 'solana' },
  { ticker: 'PEPE', chain: 'ethereum' }
])
// Returns: Map<string, TokenMetrics>
```

### Discovery

#### `getBoostedTokens()`
Get promoted tokens on DexScreener.

```typescript
const boosted = await getBoostedTokens()
// Returns: DexScreenerBoostedToken[]
```

#### `getNewPairs(chainId: string)`
Get recently created trading pairs.

```typescript
const newPairs = await getNewPairs('solana')
// Returns: DexScreenerPair[]
```

#### `searchByVolume(query: string, minVolume24h?: number)`
Search with volume filtering (default: $30k min).

```typescript
const pairs = await searchByVolume('meme', 50000)
// Returns: DexScreenerPair[]
```

### Utilities

#### `extractSocials(pair: DexScreenerPair)`
Extract social links from a pair.

```typescript
const socials = extractSocials(pair)
// Returns: { twitter?, telegram?, discord?, website? }
```

#### `getLiquidityPoolAddress(chain: string, tokenAddress: string)`
Get the primary LP address for a token.

```typescript
const lpAddress = await getLiquidityPoolAddress('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
// Returns: string | null
```

#### `pairToMetrics(pair: DexScreenerPair)`
Convert raw pair data to simplified metrics.

```typescript
const metrics = pairToMetrics(pair)
// Returns: TokenMetrics
```

## Types

```typescript
interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceNative: string
  priceUsd: string
  txns: { m5, h1, h6, h24: { buys: number; sells: number } }
  volume: { m5, h1, h6, h24: number }
  priceChange: { m5, h1, h6, h24: number }
  liquidity: { usd: number; base: number; quote: number }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: { imageUrl?, websites?, socials? }
}

interface TokenMetrics {
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
```

## Supported Chains

- Solana (`solana`, `SOL`)
- Ethereum (`ethereum`, `ETH`)
- Base (`base`, `BASE`)
- Arbitrum (`arbitrum`, `ARB`)
- BSC (`bsc`, `BSC`)
- Avalanche (`avalanche`, `AVAX`)
- Polygon (`polygon`, `MATIC`)
- Fantom (`fantom`, `FTM`)
- Optimism (`optimism`, `OP`)

## Rate Limits

DexScreener allows ~300 requests per minute. The batch functions include built-in rate limiting:
- `batchGetMetrics`: 250ms delay between requests
- `getTokensByAddresses`: 100ms delay between batches

## License

MIT
