import React from 'react';

interface CryptoData {
  timestamp: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  volume_24h: number;
  price_change_1h: number;
  price_change_24h: number;
  price_change_7d: number;
  sparkline: number[];
  last_updated: string;
}

interface GainersLosersProps {
  data: CryptoData[];
  onSymbolClick: (symbol: string) => void;
}

const GainersLosers: React.FC<GainersLosersProps> = ({ data, onSymbolClick }) => {
  // Sắp xếp dữ liệu theo price_change_24h
  const sortedData = [...data].sort((a, b) => b.price_change_24h - a.price_change_24h);
  const gainers = sortedData.slice(0, 4); // Top 4 gainers
  const losers = sortedData.slice(-4).reverse(); // Top 4 losers

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const renderCryptoCard = (crypto: CryptoData) => (
    <div 
      key={crypto.symbol} 
      className="bg-white p-4 rounded-lg shadow mb-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onSymbolClick(crypto.symbol)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
            {crypto.symbol.charAt(0)}
          </div>
          <span className="font-medium">{crypto.symbol}</span>
        </div>
        <span className="font-bold">{formatPrice(crypto.current_price)}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="text-xs">
          <div>5 minute</div>
          <div className={crypto.price_change_1h >= 0 ? 'text-green-600' : 'text-red-600'}>
            {crypto.price_change_1h >= 0 ? '+' : ''}{(crypto.price_change_1h / 12).toFixed(2)}%
          </div>
        </div>
        <div className="text-xs">
          <div>30 minute</div>
          <div className={crypto.price_change_1h >= 0 ? 'text-green-600' : 'text-red-600'}>
            {crypto.price_change_1h >= 0 ? '+' : ''}{(crypto.price_change_1h / 2).toFixed(2)}%
          </div>
        </div>
        <div className="text-xs">
          <div>4 hour</div>
          <div className={crypto.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
            {crypto.price_change_24h >= 0 ? '+' : ''}{(crypto.price_change_24h / 6).toFixed(2)}%
          </div>
        </div>
        <div className="text-xs">
          <div>12 hour</div>
          <div className={crypto.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
            {crypto.price_change_24h >= 0 ? '+' : ''}{(crypto.price_change_24h / 2).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Gainers & Losers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium text-green-600 mb-2">Top Gainers</h3>
          {gainers.map(crypto => renderCryptoCard(crypto))}
        </div>
        <div>
          <h3 className="font-medium text-red-600 mb-2">Top Losers</h3>
          {losers.map(crypto => renderCryptoCard(crypto))}
        </div>
      </div>
    </div>
  );
};

export default GainersLosers; 