import type { Instrument } from "../types.js";

// The tracked universe. Yahoo Finance chart API symbols (keyless) + Binance for crypto.
// `tags` connect instruments to event taxonomy exposures.

export const INSTRUMENTS: Instrument[] = [
  // ---- US equity indices ----
  { id: "SPX", symbol: "^GSPC", provider: "yahoo", name: "S&P 500", cls: "equity_index", group: "US Equities", tags: ["us_equities", "risk_asset", "global_growth"] },
  { id: "NDX", symbol: "^IXIC", provider: "yahoo", name: "Nasdaq", cls: "equity_index", group: "US Equities", tags: ["us_equities", "tech", "growth_stocks", "risk_asset", "rates_sensitive"] },
  { id: "DJI", symbol: "^DJI", provider: "yahoo", name: "Dow Jones", cls: "equity_index", group: "US Equities", tags: ["us_equities", "risk_asset"] },
  { id: "RUT", symbol: "^RUT", provider: "yahoo", name: "Russell 2000", cls: "equity_index", group: "US Equities", tags: ["us_equities", "small_caps", "credit_sensitive", "risk_asset"] },
  { id: "VIX", symbol: "^VIX", provider: "yahoo", name: "VIX", cls: "equity_index", group: "Volatility", tags: ["volatility", "risk_off"] },

  // ---- Global equity indices ----
  { id: "SX5E", symbol: "^STOXX50E", provider: "yahoo", name: "Euro Stoxx 50", cls: "equity_index", group: "Global Equities", tags: ["europe", "risk_asset"] },
  { id: "UKX", symbol: "^FTSE", provider: "yahoo", name: "FTSE 100", cls: "equity_index", group: "Global Equities", tags: ["europe", "uk", "risk_asset"] },
  { id: "DAX", symbol: "^GDAXI", provider: "yahoo", name: "DAX", cls: "equity_index", group: "Global Equities", tags: ["europe", "germany", "industrials", "risk_asset"] },
  { id: "NKY", symbol: "^N225", provider: "yahoo", name: "Nikkei 225", cls: "equity_index", group: "Global Equities", tags: ["japan", "asia", "risk_asset"] },
  { id: "HSI", symbol: "^HSI", provider: "yahoo", name: "Hang Seng", cls: "equity_index", group: "Global Equities", tags: ["china", "asia", "risk_asset"] },
  { id: "SHCOMP", symbol: "000001.SS", provider: "yahoo", name: "Shanghai Comp", cls: "equity_index", group: "Global Equities", tags: ["china", "asia"] },
  { id: "NIFTY", symbol: "^NSEI", provider: "yahoo", name: "Nifty 50", cls: "equity_index", group: "Global Equities", tags: ["india", "em", "risk_asset"] },
  { id: "IBOV", symbol: "^BVSP", provider: "yahoo", name: "Bovespa", cls: "equity_index", group: "Global Equities", tags: ["brazil", "em", "commodity_exporter"] },
  { id: "KOSPI", symbol: "^KS11", provider: "yahoo", name: "KOSPI", cls: "equity_index", group: "Global Equities", tags: ["korea", "asia", "semiconductors"] },

  // ---- Rates (Yahoo yield indices; values are yields in %) ----
  { id: "US3M", symbol: "^IRX", provider: "yahoo", name: "US 3M Yield", cls: "rate", group: "Rates", unit: "%", tags: ["rates", "fed", "front_end"] },
  { id: "US5Y", symbol: "^FVX", provider: "yahoo", name: "US 5Y Yield", cls: "rate", group: "Rates", unit: "%", tags: ["rates", "belly"] },
  { id: "US10Y", symbol: "^TNX", provider: "yahoo", name: "US 10Y Yield", cls: "rate", group: "Rates", unit: "%", tags: ["rates", "long_end", "term_premium"] },
  { id: "US30Y", symbol: "^TYX", provider: "yahoo", name: "US 30Y Yield", cls: "rate", group: "Rates", unit: "%", tags: ["rates", "long_end", "term_premium", "fiscal"] },

  // ---- FX ----
  { id: "DXY", symbol: "DX-Y.NYB", provider: "yahoo", name: "DXY", cls: "fx", group: "FX", tags: ["usd", "dollar_liquidity", "safe_haven"] },
  { id: "EURUSD", symbol: "EURUSD=X", provider: "yahoo", name: "EUR/USD", cls: "fx", group: "FX", tags: ["europe", "usd"] },
  { id: "USDJPY", symbol: "USDJPY=X", provider: "yahoo", name: "USD/JPY", cls: "fx", group: "FX", tags: ["japan", "usd", "carry", "rates_sensitive"] },
  { id: "USDCNY", symbol: "USDCNY=X", provider: "yahoo", name: "USD/CNY", cls: "fx", group: "FX", tags: ["china", "usd", "trade_war"] },
  { id: "GBPUSD", symbol: "GBPUSD=X", provider: "yahoo", name: "GBP/USD", cls: "fx", group: "FX", tags: ["uk", "usd"] },
  { id: "USDMXN", symbol: "USDMXN=X", provider: "yahoo", name: "USD/MXN", cls: "fx", group: "FX", tags: ["em", "mexico", "usd", "tariffs"] },
  { id: "AUDUSD", symbol: "AUDUSD=X", provider: "yahoo", name: "AUD/USD", cls: "fx", group: "FX", tags: ["commodity_exporter", "china", "risk_asset"] },

  // ---- Crypto (Binance) ----
  { id: "BTC", symbol: "BTCUSDT", provider: "binance", name: "Bitcoin", cls: "crypto", group: "Crypto", tags: ["crypto", "risk_asset", "liquidity_sensitive"] },
  { id: "ETH", symbol: "ETHUSDT", provider: "binance", name: "Ethereum", cls: "crypto", group: "Crypto", tags: ["crypto", "risk_asset", "liquidity_sensitive"] },
  { id: "SOL", symbol: "SOLUSDT", provider: "binance", name: "Solana", cls: "crypto", group: "Crypto", tags: ["crypto", "risk_asset"] },

  // ---- Commodities ----
  { id: "GOLD", symbol: "GC=F", provider: "yahoo", name: "Gold", cls: "commodity", group: "Metals", tags: ["gold", "safe_haven", "inflation_hedge", "real_rates"] },
  { id: "SILVER", symbol: "SI=F", provider: "yahoo", name: "Silver", cls: "commodity", group: "Metals", tags: ["silver", "metals", "inflation_hedge"] },
  { id: "COPPER", symbol: "HG=F", provider: "yahoo", name: "Copper", cls: "commodity", group: "Metals", tags: ["copper", "china", "global_growth", "electrification"] },
  { id: "ALUM", symbol: "ALI=F", provider: "yahoo", name: "Aluminum", cls: "commodity", group: "Metals", tags: ["aluminum", "metals", "sanctions_sensitive"] },
  { id: "WTI", symbol: "CL=F", provider: "yahoo", name: "WTI Crude", cls: "commodity", group: "Energy", tags: ["oil", "energy", "inflation", "middle_east"] },
  { id: "BRENT", symbol: "BZ=F", provider: "yahoo", name: "Brent Crude", cls: "commodity", group: "Energy", tags: ["oil", "energy", "inflation", "middle_east", "shipping"] },
  { id: "NATGAS", symbol: "NG=F", provider: "yahoo", name: "Natural Gas", cls: "commodity", group: "Energy", tags: ["natgas", "energy", "europe", "weather", "ai_power"] },
  { id: "CORN", symbol: "ZC=F", provider: "yahoo", name: "Corn", cls: "commodity", group: "Agriculture", tags: ["grains", "food", "weather"] },
  { id: "WHEAT", symbol: "ZW=F", provider: "yahoo", name: "Wheat", cls: "commodity", group: "Agriculture", tags: ["grains", "food", "russia", "ukraine", "weather"] },
  { id: "SOYB", symbol: "ZS=F", provider: "yahoo", name: "Soybeans", cls: "commodity", group: "Agriculture", tags: ["grains", "food", "china", "trade_war"] },

  // ---- Credit / duration proxies (ETFs) ----
  { id: "HYG", symbol: "HYG", provider: "yahoo", name: "High Yield (HYG)", cls: "credit", group: "Credit", tags: ["credit", "risk_asset", "credit_stress"] },
  { id: "LQD", symbol: "LQD", provider: "yahoo", name: "IG Credit (LQD)", cls: "credit", group: "Credit", tags: ["credit", "rates_sensitive"] },
  { id: "EMB", symbol: "EMB", provider: "yahoo", name: "EM Debt (EMB)", cls: "credit", group: "Credit", tags: ["em", "credit", "usd"] },
  { id: "TLT", symbol: "TLT", provider: "yahoo", name: "20Y+ Treasuries (TLT)", cls: "credit", group: "Credit", tags: ["rates", "long_end", "safe_haven"] },

  // ---- US sector ETFs ----
  { id: "XLK", symbol: "XLK", provider: "yahoo", name: "Technology", cls: "sector", group: "Sectors", tags: ["tech", "growth_stocks", "rates_sensitive"] },
  { id: "SMH", symbol: "SMH", provider: "yahoo", name: "Semiconductors", cls: "sector", group: "Sectors", tags: ["semiconductors", "taiwan", "ai", "export_controls", "china"] },
  { id: "XLE", symbol: "XLE", provider: "yahoo", name: "Energy", cls: "sector", group: "Sectors", tags: ["oil", "energy", "middle_east"] },
  { id: "XLF", symbol: "XLF", provider: "yahoo", name: "Financials", cls: "sector", group: "Sectors", tags: ["banks", "credit", "rates"] },
  { id: "KRE", symbol: "KRE", provider: "yahoo", name: "Regional Banks", cls: "sector", group: "Sectors", tags: ["banks", "credit_stress", "cre"] },
  { id: "XLI", symbol: "XLI", provider: "yahoo", name: "Industrials", cls: "sector", group: "Sectors", tags: ["industrials", "global_growth", "defense"] },
  { id: "ITA", symbol: "ITA", provider: "yahoo", name: "Defense & Aerospace", cls: "sector", group: "Sectors", tags: ["defense", "war", "geopolitics"] },
  { id: "XLB", symbol: "XLB", provider: "yahoo", name: "Materials", cls: "sector", group: "Sectors", tags: ["metals", "china", "global_growth"] },
  { id: "XLV", symbol: "XLV", provider: "yahoo", name: "Healthcare", cls: "sector", group: "Sectors", tags: ["defensive"] },
  { id: "XLU", symbol: "XLU", provider: "yahoo", name: "Utilities", cls: "sector", group: "Sectors", tags: ["defensive", "rates_sensitive", "ai_power", "electrification"] },
  { id: "XLY", symbol: "XLY", provider: "yahoo", name: "Consumer Disc.", cls: "sector", group: "Sectors", tags: ["consumer", "us_equities"] },
  { id: "XLP", symbol: "XLP", provider: "yahoo", name: "Consumer Staples", cls: "sector", group: "Sectors", tags: ["defensive", "consumer"] },
  { id: "XLRE", symbol: "XLRE", provider: "yahoo", name: "Real Estate", cls: "sector", group: "Sectors", tags: ["rates_sensitive", "cre"] },
];

export const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));
