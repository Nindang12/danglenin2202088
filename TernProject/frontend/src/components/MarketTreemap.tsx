import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

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

interface MarketTreemapProps {
  data: CryptoData[];
  onSymbolClick: (symbol: string) => void;
}

const MarketTreemap = ({ data, onSymbolClick }: MarketTreemapProps) => {
  // Sắp xếp dữ liệu theo market cap giảm dần
  const sortedData = [...data].sort((a, b) => b.market_cap - a.market_cap);
  
  // Màu sắc giống hình mẫu
  const getColor = (value: number): string => {
    // Màu xanh lá cho giá trị dương
    if (value >= 0) return '#3DD598';
    // Màu đỏ cho giá trị âm
    return '#FF5C5C';
  };
  
  // Tạo dữ liệu cho treemap
  const treeData = sortedData.map(item => {
    const color = getColor(item.price_change_24h);
    
    return {
      name: item.symbol,
      value: item.market_cap, // Kích thước dựa trên market cap
      color: color, // Màu sắc dựa trên price_change_24h
      custom: {
        price: item.current_price,
        change24h: item.price_change_24h,
        marketCap: item.market_cap,
        fullName: item.name,
        symbol: item.symbol
      }
    };
  });
  
  const chartOptions: Highcharts.Options = {
    chart: {
      style: {
        fontFamily: 'Arial, sans-serif'
      },
      backgroundColor: '#FFFFFF',
      height: '600px', // Tăng chiều cao cho treemap
      events: {
        click: function(event) {
          const point = event.point as any;
          if (point && point.custom && point.custom.symbol) {
            onSymbolClick(point.custom.symbol);
          }
        }
      }
    },
    series: [{
      type: 'treemap',
      layoutAlgorithm: 'squarified',
      clip: false,
      data: treeData,
      point: {
        events: {
          click: function() {
            const point = this as any;
            if (point.custom && point.custom.symbol) {
              onSymbolClick(point.custom.symbol);
            }
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          textOutline: 'none',
          fontWeight: 'bold',
          fontSize: '16px',
          color: '#FFFFFF'
        },
        formatter: function() {
          const point: any = this.point;
          const marketCapB = (point.custom.marketCap / 1e9).toFixed(1);
          
          return `<div style="font-size: 24px; font-weight: bold;">${point.name}</div>
                  <div style="font-size: 18px;">$${marketCapB}B</div>`;
        },
        useHTML: true
      }
    }],
    title: {
      text: 'Market Treemap (24 hour)',
      style: {
        fontWeight: 'bold',
        fontSize: '24px'
      }
    },
    subtitle: {
      text: 'Size: Market Cap, Color: 24h Change'
    },
    tooltip: {
      useHTML: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatter: function() {
        const point: any = this.point;
        const changeColor = point.custom.change24h >= 0 ? '#3DD598' : '#FF5C5C';
        
        return `<div style="padding: 8px;">
                  <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                    ${point.custom.fullName} (${point.name})
                  </div>
                  <div style="margin-bottom: 3px;">
                    <b>Price:</b> $${point.custom.price.toLocaleString()}
                  </div>
                  <div style="margin-bottom: 3px;">
                    <b>24h Change:</b> <span style="color: ${changeColor}; font-weight: bold;">
                      ${point.custom.change24h >= 0 ? '+' : ''}${point.custom.change24h.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <b>Market Cap:</b> $${(point.custom.marketCap / 1e9).toFixed(2)}B
                  </div>
                </div>`;
      }
    },
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default MarketTreemap; 