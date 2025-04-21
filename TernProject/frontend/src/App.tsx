import { useState, useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/accessibility';
import 'highcharts/modules/exporting';
import 'highcharts/modules/export-data';

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
    profile_image?: string;
  }[];
  timestamp: string;
}

interface MarketMetrics {
  marketCap: number;
  marketCapChange: number;
  holders: number;
  holdersChange: number;
  marketCapVsAgents: number;
  holdersVsAgents: number;
  mindshareHistory: [number, number][];  // [timestamp, value][]
  priceHistory7d: number[];
}

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
  market_metrics: MarketMetrics;
  twitter_data?: TwitterData;
}

function App() {
  const [btcData, setBtcData] = useState<CryptoData | null>(null);
  const [priceHistory, setPriceHistory] = useState<[number, number][]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  // Kết nối WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8765');
      
      ws.onopen = () => {
        console.log('Connected to WebSocket server');
        setIsConnected(true);
        
        // Gửi cấu hình ban đầu
        ws.send(JSON.stringify({
          type: 'dashboard_data',
          symbols: ['BTC'],
          interval: 1
        }));

        // Yêu cầu Twitter data
        ws.send(JSON.stringify({
          type: 'request_twitter_data'
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          // Xử lý theo loại message
          switch (response.type) {
            case 'crypto_data':
              const btcData = response.data[0];
              console.log('Received BTC data:', btcData);
              setBtcData(prevData => ({
                ...btcData,
                twitter_data: prevData?.twitter_data // Giữ nguyên Twitter data cũ
              }));
              
              // Cập nhật price history
              const timestamp = Date.now();
              setPriceHistory(prev => {
                const newHistory = [...prev, [timestamp, btcData.current_price]];
                return newHistory.length > 300 ? newHistory.slice(-300) : newHistory;
              });
              
              setLastUpdated(new Date().toLocaleString());
              
              // Cập nhật biểu đồ
              if (chartRef.current) {
                const series = chartRef.current.series[0];
                if (series) {
                  series.addPoint([timestamp, btcData.current_price], true, series.data.length > 300);
                }
              }
              break;

            case 'twitter_data':
              console.log('Received Twitter data:', response.data);
              setBtcData(prevData => prevData ? {
                ...prevData,
                twitter_data: response.data
              } : null);
              break;

            default:
              console.log('Unknown message type:', response.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        setIsConnected(false);
        setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Cấu hình biểu đồ giá
  const priceChartOptions: Highcharts.Options = {
    chart: {
      type: 'line',
      animation: true,
      events: {
        load: function() {
          chartRef.current = this;
        }
      },
      height: 400,
      backgroundColor: '#1a1a1a',
      style: {
        fontFamily: 'Arial, sans-serif'
      }
    },
    title: {
      text: 'Bitcoin Real-time Price (1s)',
      style: {
        color: '#ffffff',
        fontWeight: 'bold'
      }
    },
    xAxis: {
      type: 'datetime',
      labels: {
        style: {
          color: '#cccccc'
        }
      },
      gridLineColor: '#333333',
      tickColor: '#333333',
      lineColor: '#333333'
    },
    yAxis: {
      title: {
        text: 'Price (USD)',
        style: {
          color: '#cccccc'
        }
      },
      labels: {
        format: '${value}',
        style: {
          color: '#cccccc'
        }
      },
      gridLineColor: '#333333'
    },
    legend: {
      enabled: false
    },
    plotOptions: {
      line: {
        marker: {
          enabled: false
        },
        lineWidth: 2,
        states: {
          hover: {
            lineWidth: 3
          }
        }
      }
    },
    tooltip: {
      headerFormat: '<b>{series.name}</b><br/>',
      pointFormat: '{point.x:%Y-%m-%d %H:%M:%S}<br/>${point.y:.2f}',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      style: {
        color: '#ffffff'
      }
    },
    series: [{
      type: 'line',
      name: 'BTC/USDT',
      data: priceHistory,
      color: '#f7931a' // Bitcoin orange
    }],
    credits: {
      enabled: false
    }
  };

  // Cấu hình biểu đồ Twitter Mindshare (thay đổi từ pie sang bar)
  const twitterMindshareOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      backgroundColor: '#1a1a1a',
      height: 300
    },
    title: {
      text: 'Bitcoin Twitter Mindshare',
      style: {
        color: '#ffffff',
        fontWeight: 'bold'
      }
    },
    xAxis: {
      categories: ['Bitcoin', 'Other Crypto'],
      labels: {
        style: {
          color: '#cccccc'
        }
      }
    },
    yAxis: {
      min: 0,
      max: 100,
      title: {
        text: 'Percentage (%)',
        style: {
          color: '#cccccc'
        }
      },
      labels: {
        style: {
          color: '#cccccc'
        }
      },
      gridLineColor: '#333333'
    },
    tooltip: {
      valueSuffix: '%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      style: {
        color: '#ffffff'
      }
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true,
          format: '{y}%',
          style: {
            color: '#cccccc'
          }
        }
      }
    },
    series: [{
      name: 'Mindshare',
      type: 'bar',
      data: btcData?.twitter_data ? [
        {
          name: 'Bitcoin',
          y: btcData.twitter_data.mindshare,
          color: '#f7931a' // Bitcoin orange
        },
        {
          name: 'Other Crypto',
          y: 100 - btcData.twitter_data.mindshare,
          color: '#333333'
        }
      ] : []
    }],
    credits: {
      enabled: false
    }
  };

  // Cấu hình biểu đồ Twitter Time Distribution
  const twitterTimeDistributionOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      backgroundColor: '#1a1a1a',
      height: 300
    },
    title: {
      text: 'Bitcoin Twitter Activity (24h)',
      style: {
        color: '#ffffff',
        fontWeight: 'bold'
      }
    },
    xAxis: {
      categories: btcData?.twitter_data ? Object.keys(btcData.twitter_data.time_distribution) : [],
      labels: {
        style: {
          color: '#cccccc'
        }
      }
    },
    yAxis: {
      min: 0,
      title: {
        text: 'Tweet Count',
        style: {
          color: '#cccccc'
        }
      },
      labels: {
        style: {
          color: '#cccccc'
        }
      },
      gridLineColor: '#333333'
    },
    tooltip: {
      headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
      pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
        '<td style="padding:0"><b>{point.y}</b></td></tr>',
      footerFormat: '</table>',
      shared: true,
      useHTML: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      style: {
        color: '#ffffff'
      }
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
      data: btcData?.twitter_data ? Object.values(btcData.twitter_data.time_distribution) : [],
      color: '#1DA1F2' // Twitter blue
    }],
    credits: {
      enabled: false
    }
  };

  // Cập nhật component để hiển thị metrics
  const MarketMetricsDisplay = ({ data }: { data: MarketMetrics }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Market cap</span>
            <span className="text-sm text-gray-500">#15</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold">{data.marketCap.toFixed(2)}M</span>
            <span className={`ml-2 text-sm ${data.marketCapChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.marketCapChange >= 0 ? '+' : ''}{data.marketCapChange}%
            </span>
          </div>
          <div className="mt-2">
            <div className={`text-sm ${data.marketCapVsAgents >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.marketCapVsAgents >= 0 ? '+' : ''}{data.marketCapVsAgents}%
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Holders</span>
            <span className="text-sm text-gray-500">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold">{data.holders.toLocaleString()}</span>
            <span className={`ml-2 text-sm ${data.holdersChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.holdersChange >= 0 ? '+' : ''}{data.holdersChange}%
            </span>
          </div>
          <div className="mt-2">
            <div className={`text-sm ${data.holdersVsAgents >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.holdersVsAgents >= 0 ? '+' : ''}{data.holdersVsAgents}%
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center">Bitcoin Real-time Price & Twitter Tracker</h1>
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div>Last updated: {lastUpdated}</div>
        </div>
      </header>

      {/* Price Display */}
      {btcData && (
        <div className="mb-8 bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{btcData.name} ({btcData.symbol})</h2>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">${btcData.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`text-lg ${btcData.price_change_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {btcData.price_change_24h >= 0 ? '▲' : '▼'} {Math.abs(btcData.price_change_24h).toFixed(2)}% (24h)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Chart */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-8">
        <HighchartsReact highcharts={Highcharts} options={priceChartOptions} />
      </div>

      {/* Twitter Data Section */}
      {btcData?.twitter_data ? (
        <>
          <h2 className="text-2xl font-bold mb-4">Twitter Analysis</h2>
          
          {/* Twitter Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="text-gray-400">Total Tweets</div>
              <div className="text-2xl font-bold">{btcData.twitter_data.total_tweets.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="text-gray-400">Avg. Engagement</div>
              <div className="text-2xl font-bold">{btcData.twitter_data.avg_engagement.toFixed(1)}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="text-gray-400">Avg. Impressions</div>
              <div className="text-2xl font-bold">{btcData.twitter_data.avg_impressions.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="text-gray-400">Sentiment</div>
              <div className={`text-2xl font-bold ${btcData.twitter_data.sentiment_score >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {btcData.twitter_data.sentiment_score.toFixed(1)}
              </div>
            </div>
          </div>
          
          {/* Twitter Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <HighchartsReact highcharts={Highcharts} options={twitterMindshareOptions} />
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <HighchartsReact highcharts={Highcharts} options={twitterTimeDistributionOptions} />
            </div>
          </div>
          
          

      {/* Market Metrics Section */}
      {btcData?.twitter_data && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Market Metrics</h2>
            <MarketMetricsDisplay data={{
              marketCap: 285.01,
              marketCapChange: -0.8,
              holders: 120433,
              holdersChange: 3.5,
              marketCapVsAgents: 59.22,
              holdersVsAgents: -15.12
            }} />
          </div>
        )}

          {/* Top Tweets */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-xl font-bold mb-4">Top Tweets about Bitcoin</h2>
            <div className="space-y-4">
              {btcData.twitter_data.top_tweets.map((tweet) => (
                <div key={tweet.id} className="border-b border-gray-700 pb-4">
                  <div className="flex items-start space-x-3">
                    {tweet.profile_image && (
                      <img 
                        src={tweet.profile_image} 
                        alt={tweet.author} 
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="font-bold mr-2">{tweet.author}</span>
                        <span className="text-gray-400">@{tweet.username}</span>
                        <span className="text-gray-500 mx-2">·</span>
                        <a 
                          href={tweet.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </a>
                      </div>
                      <p className="mb-2 whitespace-pre-wrap">{tweet.text}</p>
                      <div className="flex text-gray-400 text-sm space-x-6">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                          {tweet.likes.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.77 15.67c-.292-.293-.767-.293-1.06 0l-2.22 2.22V7.65c0-2.068-1.683-3.75-3.75-3.75h-5.85c-.414 0-.75.336-.75.75s.336.75.75.75h5.85c1.24 0 2.25 1.01 2.25 2.25v10.24l-2.22-2.22c-.293-.293-.768-.293-1.06 0s-.294.768 0 1.06l3.5 3.5c.145.147.337.22.53.22s.383-.072.53-.22l3.5-3.5c.294-.292.294-.767 0-1.06zm-10.66 3.28H7.26c-1.24 0-2.25-1.01-2.25-2.25V6.46l2.22 2.22c.148.147.34.22.532.22s.384-.073.53-.22c.293-.293.293-.768 0-1.06l-3.5-3.5c-.293-.294-.768-.294-1.06 0l-3.5 3.5c-.294.292-.294.767 0 1.06s.767.293 1.06 0l2.22-2.22V16.7c0 2.068 1.683 3.75 3.75 3.75h5.85c.414 0 .75-.336.75-.75s-.337-.75-.75-.75z"/>
                          </svg>
                          {tweet.retweets.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14.046 2.242l-4.148-.01h-.002c-4.374 0-7.8 3.427-7.8 7.802 0 4.098 3.186 7.206 7.465 7.37v3.828c0 .108.044.286.12.403.142.225.384.347.632.347.138 0 .277-.038.402-.118.264-.168 6.473-4.14 8.088-5.506 1.902-1.61 3.04-3.97 3.043-6.312v-.017c-.006-4.367-3.43-7.787-7.8-7.788zm3.787 12.972c-1.134.96-4.862 3.405-6.772 4.643V16.67c0-.414-.335-.75-.75-.75h-.396c-3.66 0-6.318-2.476-6.318-5.886 0-3.534 2.768-6.302 6.3-6.302l4.147.01h.002c3.532 0 6.3 2.766 6.302 6.296-.003 1.91-.942 3.844-2.514 5.176z"/>
                          </svg>
                          {tweet.replies.toLocaleString()}
                        </span>
                        {tweet.views > 0 && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                            {tweet.views.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-lg text-gray-400">Loading Twitter data for Bitcoin...</p>
        </div>
      )}
    </div>
  );
}

export default App;
