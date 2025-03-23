import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

interface TwitterData {
  symbol: string;
  total_tweets: number;
  avg_engagement: number;
  avg_impressions: number;
  sentiment_score: number;
  mindshare: number;
  time_distribution: {
    [key: string]: number;
  };
  top_tweets: {
    id: string;
    text: string;
    created_at: string;
    author: string;
    username: string;
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    url: string;
  }[];
  timestamp: string;
}

interface CurrencyDetailProps {
  data: CryptoData[];
  isConnected: boolean;
  lastUpdated: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

const CurrencyDetail = ({ data, isConnected, lastUpdated, wsRef }: CurrencyDetailProps) => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  
  const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
  const [twitterData, setTwitterData] = useState<TwitterData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTwitterLoading, setIsTwitterLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('price');
  const [timeframe, setTimeframe] = useState<string>('7d');
  const [realTimeData, setRealTimeData] = useState<number[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  // Lọc dữ liệu từ props theo symbol và cập nhật khi có dữ liệu mới
  useEffect(() => {
    if (data && data.length > 0 && symbol) {
      const filteredData = data.find(item => item.symbol.toUpperCase() === symbol.toUpperCase());
      if (filteredData) {
        setCryptoData(filteredData);
        
        // Cập nhật giá mới nhất
        if (filteredData.current_price !== lastPrice) {
          setLastPrice(filteredData.current_price);
          
          // Thêm giá mới vào dữ liệu real-time
          setRealTimeData(prevData => {
            const newData = [...prevData, filteredData.current_price];
            // Giữ tối đa 100 điểm dữ liệu
            if (newData.length > 100) {
              return newData.slice(-100);
            }
            return newData;
          });
        }
        
        setIsLoading(false);
      }
    }
  }, [data, symbol, lastPrice]);

  // Kết nối WebSocket để lấy dữ liệu Twitter
  useEffect(() => {
    if (!symbol) return;
    
    // Sử dụng WebSocket đã được kết nối từ App
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Using existing WebSocket connection for Twitter data');
      
      // Gửi yêu cầu dữ liệu Twitter cho token cụ thể
      wsRef.current.send(JSON.stringify({
        type: 'twitter_data',
        symbol: symbol
      }));
      
      // Thêm event listener cho tin nhắn
      const handleMessage = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === 'twitter_data') {
            if (response.data) {
              console.log('Received Twitter data:', response.data);
              setTwitterData(response.data);
            } else if (response.error) {
              console.error('Twitter data error:', response.error);
            }
            setIsTwitterLoading(false);
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };
      
      wsRef.current.addEventListener('message', handleMessage);
      
      // Cleanup
      return () => {
        if (wsRef.current) {
          wsRef.current.removeEventListener('message', handleMessage);
        }
      };
    } else {
      console.log('WebSocket not connected, creating new connection');
      
      // Tạo kết nối mới nếu cần
      const ws = new WebSocket('ws://localhost:8765');
      
      ws.onopen = () => {
        console.log('Connected to WebSocket server for Twitter data');
        
        // Gửi yêu cầu dữ liệu Twitter cho token cụ thể
        ws.send(JSON.stringify({
          type: 'twitter_data',
          symbol: symbol
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === 'twitter_data') {
            if (response.data) {
              console.log('Received Twitter data:', response.data);
              setTwitterData(response.data);
            } else if (response.error) {
              console.error('Twitter data error:', response.error);
            }
            setIsTwitterLoading(false);
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Twitter WebSocket connection closed');
      };
      
      // Cleanup
      return () => {
        ws.close();
      };
    }
  }, [symbol, wsRef]);

  // Hiển thị trạng thái kết nối
  const renderConnectionStatus = () => {
    if (!isConnected) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          Đang kết nối lại với máy chủ...
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!cryptoData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-xl mb-4">Không tìm thấy dữ liệu cho {symbol}</p>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => navigate('/')}
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }
  
  // Tạo dữ liệu cho biểu đồ giá real-time
  const priceChartOptions: Highcharts.Options = {
    chart: {
      height: 400,
      animation: {
        duration: 500
      }
    },
    title: {
      text: `${cryptoData?.name || symbol} (${symbol}) Real-time Price Chart`
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 150,
      maxPadding: 0.1
    },
    yAxis: {
      title: {
        text: 'Price (USD)'
      },
      labels: {
        format: '${value}'
      },
      plotLines: [{
        value: 0,
        width: 1,
        color: '#808080'
      }]
    },
    legend: {
      enabled: true
    },
    tooltip: {
      valueDecimals: 2,
      valuePrefix: '$',
      xDateFormat: '%Y-%m-%d %H:%M:%S'
    },
    plotOptions: {
      area: {
        fillColor: {
          linearGradient: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 1
          },
          stops: [
            [0, Highcharts.color('#2f7ed8').setOpacity(0.6).get('rgba') as string],
            [1, Highcharts.color('#2f7ed8').setOpacity(0).get('rgba') as string]
          ]
        },
        marker: {
          radius: 2
        },
        lineWidth: 1,
        states: {
          hover: {
            lineWidth: 1
          }
        },
        threshold: null
      },
      line: {
        marker: {
          enabled: false
        }
      }
    },
    series: [
      {
        type: 'line',
        name: `${symbol} Price`,
        data: realTimeData.length > 0 
          ? realTimeData.map((price, i) => [Date.now() - (realTimeData.length - 1 - i) * 1000, price]) 
          : cryptoData?.sparkline 
            ? cryptoData.sparkline.map((price, i) => [Date.now() - (cryptoData.sparkline.length - 1 - i) * 1000, price]) 
            : [],
        color: '#F7931A'
      }
    ],
    credits: {
      enabled: false
    }
  };
  
  // Tạo dữ liệu cho biểu đồ thống kê
  const statsChartOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 300
    },
    title: {
      text: `${cryptoData.symbol} Price Change`
    },
    xAxis: {
      categories: ['1h', '24h', '7d'],
      crosshair: true
    },
    yAxis: {
      title: {
        text: 'Change (%)'
      },
      labels: {
        format: '{value}%'
      }
    },
    tooltip: {
      headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
      pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
        '<td style="padding:0"><b>{point.y:.2f}%</b></td></tr>',
      footerFormat: '</table>',
      shared: true,
      useHTML: true
    },
    plotOptions: {
      column: {
        pointPadding: 0.2,
        borderWidth: 0,
        colorByPoint: true,
        colors: [
          cryptoData.price_change_1h >= 0 ? '#3DD598' : '#FF6B6B',
          cryptoData.price_change_24h >= 0 ? '#3DD598' : '#FF6B6B',
          cryptoData.price_change_7d >= 0 ? '#3DD598' : '#FF6B6B'
        ]
      }
    },
    series: [{
      name: 'Price Change',
      type: 'column',
      data: [
        cryptoData.price_change_1h,
        cryptoData.price_change_24h,
        cryptoData.price_change_7d
      ]
    }],
    credits: {
      enabled: false
    }
  };
  
  // Tạo dữ liệu cho biểu đồ Twitter Mindshare
  const twitterMindshareOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: 300
    },
    title: {
      text: `${cryptoData.symbol} Twitter Mindshare`
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
    },
    accessibility: {
      point: {
        valueSuffix: '%'
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %'
        }
      }
    },
    series: [{
      name: 'Mindshare',
      type: 'pie',
      data: twitterData ? [
        {
          name: cryptoData.symbol,
          y: twitterData.mindshare,
          sliced: true,
          selected: true
        },
        {
          name: 'Other Crypto',
          y: 100 - twitterData.mindshare
        }
      ] : []
    }],
    credits: {
      enabled: false
    }
  };
  
  // Tạo dữ liệu cho biểu đồ Twitter Engagement
  const twitterEngagementOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 300
    },
    title: {
      text: `${cryptoData.symbol} Twitter Metrics`
    },
    xAxis: {
      categories: ['Engagement (Avg.)', 'Impressions (Avg.)', 'Sentiment Score']
    },
    yAxis: [{
      title: {
        text: 'Engagement & Impressions'
      }
    }, {
      title: {
        text: 'Sentiment Score'
      },
      opposite: true,
      min: -100,
      max: 100
    }],
    tooltip: {
      shared: true
    },
    series: twitterData ? [
      {
        name: 'Engagement',
        type: 'column',
        data: [twitterData.avg_engagement, null, null],
        color: '#3DD598'
      },
      {
        name: 'Impressions',
        type: 'column',
        data: [null, twitterData.avg_impressions, null],
        color: '#2F7ED8'
      },
      {
        name: 'Sentiment',
        type: 'column',
        data: [null, null, twitterData.sentiment_score],
        yAxis: 1,
        color: twitterData.sentiment_score >= 0 ? '#3DD598' : '#FF6B6B'
      }
    ] : [],
    credits: {
      enabled: false
    }
  };
  
  // Tạo dữ liệu cho biểu đồ Twitter Time Distribution
  const twitterTimeDistributionOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 300
    },
    title: {
      text: `${cryptoData.symbol} Twitter Activity (24h)`
    },
    xAxis: {
      categories: twitterData ? Object.keys(twitterData.time_distribution) : [],
      crosshair: true
    },
    yAxis: {
      min: 0,
      title: {
        text: 'Tweet Count'
      }
    },
    tooltip: {
      headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
      pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
        '<td style="padding:0"><b>{point.y}</b></td></tr>',
      footerFormat: '</table>',
      shared: true,
      useHTML: true
    },
    plotOptions: {
      column: {
        pointPadding: 0.2,
        borderWidth: 0
      }
    },
    series: [{
      name: 'Tweets',
      type: 'column',
      data: twitterData ? Object.values(twitterData.time_distribution) : [],
      color: '#1DA1F2'  // Twitter blue
    }],
    credits: {
      enabled: false
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50">
      {renderConnectionStatus()}
      
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            className="mr-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => navigate('/')}
          >
            &larr; Back
          </button>
          <h1 className="text-3xl font-bold">{cryptoData.name} ({cryptoData.symbol})</h1>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdated}
        </div>
      </div>
      
      {/* Thông tin tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500">Current Price</div>
          <div className="text-2xl font-bold">${cryptoData.current_price.toLocaleString()}</div>
          <div className={`text-sm ${cryptoData.price_change_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {cryptoData.price_change_24h >= 0 ? '▲' : '▼'} {Math.abs(cryptoData.price_change_24h).toFixed(2)}% (24h)
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500">Market Cap</div>
          <div className="text-2xl font-bold">${(cryptoData.market_cap / 1e9).toFixed(2)}B</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500">24h Volume</div>
          <div className="text-2xl font-bold">${(cryptoData.volume_24h / 1e9).toFixed(2)}B</div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-6">
        <div className="flex border-b overflow-x-auto">
          <button 
            className={`px-4 py-2 ${activeTab === 'price' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('price')}
          >
            Price Chart
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'stats' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'twitter' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('twitter')}
          >
            Twitter Analysis
          </button>
        </div>
      </div>
      
      {/* Timeframe Selector (chỉ hiển thị cho tab price) */}
      {activeTab === 'price' && (
        <div className="mb-6 flex justify-end">
          <div className="flex space-x-2">
            <button 
              className={`px-3 py-1 ${timeframe === '24h' ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setTimeframe('24h')}
            >
              24h
            </button>
            <button 
              className={`px-3 py-1 ${timeframe === '7d' ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setTimeframe('7d')}
            >
              7d
            </button>
            <button 
              className={`px-3 py-1 ${timeframe === '30d' ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setTimeframe('30d')}
            >
              30d
            </button>
          </div>
        </div>
      )}
      
      {/* Chart Content */}
      {activeTab === 'price' && (
        <div className="bg-white p-4 rounded-lg shadow mb-8">
          <HighchartsReact highcharts={Highcharts} options={priceChartOptions} />
        </div>
      )}
      
      {activeTab === 'stats' && (
        <div className="bg-white p-4 rounded-lg shadow mb-8">
          <HighchartsReact highcharts={Highcharts} options={statsChartOptions} />
        </div>
      )}
      
      {/* Twitter Analysis Content */}
      {activeTab === 'twitter' && (
        <>
          {isTwitterLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : twitterData ? (
            <>
              {/* Twitter Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-gray-500">Total Tweets</div>
                  <div className="text-2xl font-bold">{twitterData.total_tweets.toLocaleString()}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-gray-500">Avg. Engagement</div>
                  <div className="text-2xl font-bold">{twitterData.avg_engagement.toFixed(1)}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-gray-500">Avg. Impressions</div>
                  <div className="text-2xl font-bold">{twitterData.avg_impressions.toLocaleString()}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-gray-500">Sentiment</div>
                  <div className={`text-2xl font-bold ${twitterData.sentiment_score >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {twitterData.sentiment_score.toFixed(1)}
                  </div>
                </div>
              </div>
              
              {/* Twitter Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-4 rounded-lg shadow">
                  <HighchartsReact highcharts={Highcharts} options={twitterMindshareOptions} />
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <HighchartsReact highcharts={Highcharts} options={twitterEngagementOptions} />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow mb-8">
                <HighchartsReact highcharts={Highcharts} options={twitterTimeDistributionOptions} />
              </div>
              
              {/* Top Tweets */}
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-bold mb-4">Top Tweets about {cryptoData.symbol}</h2>
                <div className="space-y-4">
                  {twitterData.top_tweets.map((tweet) => (
                    <div key={tweet.id} className="border-b pb-4">
                      <div className="flex items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <span className="font-bold mr-2">{tweet.author}</span>
                            <span className="text-gray-500">@{tweet.username}</span>
                          </div>
                          <p className="mb-2">{tweet.text}</p>
                          <div className="flex text-gray-500 text-sm space-x-4">
                            <span>❤️ {tweet.likes}</span>
                            <span>🔄 {tweet.retweets}</span>
                            <span>💬 {tweet.replies}</span>
                            {tweet.views > 0 && <span>👁️ {tweet.views.toLocaleString()}</span>}
                          </div>
                        </div>
                        <a 
                          href={tweet.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-500 hover:text-blue-700"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow mb-8 text-center">
              <p className="text-lg text-gray-600">No Twitter data available for {cryptoData.symbol}</p>
            </div>
          )}
        </>
      )}
      
      {/* Thông tin chi tiết (chỉ hiển thị ở tab price và stats) */}
      {(activeTab === 'price' || activeTab === 'stats') && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">About {cryptoData.name}</h2>
          <p className="text-gray-700">
            {cryptoData.name} ({cryptoData.symbol}) is a cryptocurrency with a current price of ${cryptoData.current_price.toLocaleString()}.
            It has a market cap of ${(cryptoData.market_cap / 1e9).toFixed(2)} billion and a 24-hour trading volume of 
            ${(cryptoData.volume_24h / 1e9).toFixed(2)} billion.
          </p>
          <div className="mt-4">
            <h3 className="font-bold mb-2">Price Changes</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-gray-500">1 Hour</div>
                <div className={`font-bold ${cryptoData.price_change_1h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {cryptoData.price_change_1h >= 0 ? '+' : ''}{cryptoData.price_change_1h.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-gray-500">24 Hours</div>
                <div className={`font-bold ${cryptoData.price_change_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {cryptoData.price_change_24h >= 0 ? '+' : ''}{cryptoData.price_change_24h.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-gray-500">7 Days</div>
                <div className={`font-bold ${cryptoData.price_change_7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {cryptoData.price_change_7d >= 0 ? '+' : ''}{cryptoData.price_change_7d.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrencyDetail; 