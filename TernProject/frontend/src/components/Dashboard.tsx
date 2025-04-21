import { useNavigate } from 'react-router-dom';
import MarketTreemap from './MarketTreemap';
import GainersLosers from './GainersLosers';

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

interface DashboardProps {
  data: CryptoData[];
  isConnected: boolean;
  lastUpdated: string;
}

const Dashboard = ({ data, isConnected, lastUpdated }: DashboardProps) => {
  const navigate = useNavigate();
  
  const handleSymbolClick = (symbol: string) => {
    navigate(`/currencies/${symbol}`);
  };
  
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-center">Real-time Cryptocurrency Dashboard</h1>
      
      {/* Connection Status */}
      <div className="mb-4 flex justify-between items-center">
        <div className={`flex items-center ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        {lastUpdated && <p>Last updated: {lastUpdated}</p>}
      </div>
      
      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gainers & Losers */}
        <div>
          {data.length > 0 && <GainersLosers data={data} onSymbolClick={handleSymbolClick} />}
        </div>
        
        {/* Market Treemap */}
        <div>
          {data.length > 0 && <MarketTreemap data={data} onSymbolClick={handleSymbolClick} />}
        </div>
      </div>
      
      {/* Loading State */}
      {data.length === 0 && (
        <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow">
          <p className="text-xl">Loading data...</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 