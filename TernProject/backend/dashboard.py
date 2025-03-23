import asyncio
import json
import websockets
import pandas as pd
import requests
from datetime import datetime, timedelta
import time
import logging
import redis
from pathlib import Path
from twitter.search import Search
import os
from dotenv import load_dotenv
import threading
from httpx import Client
import aiohttp

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Redis connection
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
CACHE_EXPIRY = 60 * 15  # 15 minutes

# Twitter API setup
email = os.getenv("TWITTER_EMAIL")
username = os.getenv("TWITTER_USERNAME")
password = os.getenv("TWITTER_PASSWORD")

# List of tokens to track
TRACKED_TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'DOGE', 'USDT']

# Global variable to store Twitter data
twitter_data = None

# Hàm khởi tạo Twitter search và lấy dữ liệu
def init_twitter_data():
    """Initialize Twitter data from API or fallback to file"""
    try:
        # Try to get data from Twitter API first
        logger.info("Attempting to fetch Twitter data from API...")
        api_data = get_twitter_data_from_api()
        
        if api_data:
            logger.info("Successfully fetched Twitter data from API")
            return api_data
            
        # If API fails, read from file
        logger.info("Falling back to Twitter data from file")
        file_data = read_twitter_data_from_file()
        
        if file_data:
            logger.info("Successfully loaded Twitter data from file")
            return file_data
            
        logger.error("Failed to get Twitter data from both API and file")
        return None
        
    except Exception as e:
        logger.error(f"Error initializing Twitter data: {e}")
        return None

def get_twitter_data_from_api():
    """Original function to get Twitter data from API"""
    try:
        # Get Twitter credentials
        email = os.getenv("TWITTER_EMAIL")
        username = os.getenv("TWITTER_USERNAME")
        password = os.getenv("TWITTER_PASSWORD")

        if not all([email, username, password]):
            raise ValueError("Twitter credentials not found")

        # Khởi tạo Twitter search
        browser_cookie_file = Path("twitter_browser_cookies.json")
        
        if browser_cookie_file.exists():
            logger.info("Using browser-generated cookies")
            cookies = json.loads(browser_cookie_file.read_text())
            client = Client(cookies=cookies, follow_redirects=True)
            search = Search(session=client, debug=2)
        else:
            session_file = Path("twitter_session.cookies")
            
            if session_file.exists():
                logger.info("Using existing session file")
                search = Search(cookies="twitter_session.cookies", debug=2)
            else:
                logger.info("No session file found, using direct login")
                search = Search(email, username, password, debug=2)
                search.save_cookies("twitter_session.cookies")
                logger.info("Session saved for future use")

        # Tìm kiếm tweets về Bitcoin
        logger.info("Searching for Bitcoin tweets...")
        results = search.run(
            limit=100,
            retries=3,
            queries=[
                {
                    'category': 'Top',
                    'query': 'crypto BTC bitcoin'
                },
                {
                    'category': 'Latest',
                    'query': 'crypto BTC bitcoin'
                }
            ],
        )

        if results and isinstance(results, list) and len(results) > 0:
            tweets = []
            for result_set in results:
                if result_set:
                    tweets.extend(result_set)

            # Xử lý tweets
            processed_data = process_twitter_data(tweets)
            logger.info(f"Successfully processed {len(tweets)} tweets")
            
            # Lưu dữ liệu mới vào file để sử dụng sau này
            data_folder = Path("data/search_results")
            data_folder.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = data_folder / f"twitter_btc_{timestamp}.json"
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(tweets, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved new Twitter data to {output_file}")
            
            return processed_data
            
        logger.error("No tweets found from API")
        return None

    except Exception as e:
        logger.error(f"Error getting Twitter data from API: {e}")
        return None

def process_twitter_entry(entry):
    """Process a single Twitter entry"""
    try:
        # Get tweet data from nested structure
        tweet_content = entry.get('content', {}).get('itemContent', {}).get('tweet_results', {}).get('result', {})
        if not tweet_content:
            return None

        # Get user information
        user_data = tweet_content.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {})
        
        # Get tweet information
        tweet_legacy = tweet_content.get('legacy', {})
        
        # Create tweet object with simpler structure
        tweet = {
            'id': tweet_content.get('rest_id', ''),
            'text': tweet_legacy.get('full_text', ''),
            'created_at': tweet_legacy.get('created_at', ''),
            'author': user_data.get('name', ''),
            'username': user_data.get('screen_name', ''),
            'likes': tweet_legacy.get('favorite_count', 0),
            'retweets': tweet_legacy.get('retweet_count', 0),
            'replies': tweet_legacy.get('reply_count', 0),
            'views': tweet_legacy.get('view_count', 0),
            'profile_image': user_data.get('profile_image_url_https', ''),
            'url': f"https://twitter.com/{user_data.get('screen_name', '')}/status/{tweet_content.get('rest_id', '')}"
        }
        
        return tweet
    except Exception as e:
        logger.error(f"Error processing tweet entry: {e}")
        return None

def process_twitter_data(tweets):
    """Process Twitter data from raw tweets list"""
    try:
        processed_tweets = []
        total_likes = 0
        total_retweets = 0
        total_replies = 0
        total_views = 0
        sentiment_sum = 0
        
        # Process each tweet entry
        for entry in tweets:
            tweet = process_twitter_entry(entry)
            if tweet:
                processed_tweets.append(tweet)
                
                # Update metrics
                total_likes += tweet['likes']
                total_retweets += tweet['retweets']
                total_replies += tweet['replies']
                total_views += tweet['views']
                
                # Simple sentiment analysis
                text = tweet['text'].lower()
                if any(word in text for word in ['bullish', 'moon', 'buy', 'up', 'gain']):
                    sentiment_sum += 1
                elif any(word in text for word in ['bearish', 'crash', 'sell', 'down']):
                    sentiment_sum -= 1

        total_tweets = len(processed_tweets)
        if total_tweets == 0:
            return None

        # Calculate metrics
        avg_engagement = (total_likes + total_retweets + total_replies) / total_tweets
        avg_impressions = total_views / total_tweets if total_views > 0 else 0
        sentiment_score = (sentiment_sum / total_tweets) * 100 if total_tweets > 0 else 0

        # Create simulated time distribution (since actual data is hard to get accurately)
        time_distribution = {
            '0-4h': total_tweets // 6,
            '4-8h': total_tweets // 6,
            '8-12h': total_tweets // 6,
            '12-16h': total_tweets // 6,
            '16-20h': total_tweets // 6,
            '20-24h': total_tweets // 6,
        }

        return {
            'symbol': 'BTC',
            'total_tweets': total_tweets,
            'avg_engagement': avg_engagement,
            'avg_impressions': avg_impressions,
            'sentiment_score': sentiment_score,
            'mindshare': 75.0,  # Sample value
            'time_distribution': time_distribution,
            'top_tweets': sorted(processed_tweets, 
                               key=lambda x: x['likes'] + x['retweets'], 
                               reverse=True)[:5],
            'timestamp': datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error processing Twitter data: {e}")
        return None

# Add function to calculate mindshare from tweets
def calculate_mindshare_metrics(tweets, current_time):
    """Calculate mindshare metrics from tweets data"""
    try:
        # Calculate total tweets and engagement
        total_tweets = len(tweets)
        if total_tweets == 0:
            return None
            
        # Calculate mindshare for the last 7 days
        days_data = {
            current_time - i * 86400000: 0 for i in range(7)
        }
        
        for tweet in tweets:
            try:
                tweet_time = datetime.strptime(tweet['created_at'], "%a %b %d %H:%M:%S +0000 %Y")
                tweet_timestamp = int(tweet_time.timestamp() * 1000)
                
                # Find the nearest day
                closest_day = min(days_data.keys(), 
                                key=lambda x: abs(x - tweet_timestamp))
                
                # Calculate mindshare score for tweet based on engagement
                engagement_score = (
                    tweet['likes'] * 1.0 + 
                    tweet['retweets'] * 2.0 + 
                    tweet['replies'] * 1.5 + 
                    tweet['views'] * 0.1
                ) / 1000  # Normalize score
                
                days_data[closest_day] += engagement_score
                
            except Exception as e:
                logger.error(f"Error processing tweet for mindshare: {e}")
                continue
                
        # Normalize scores to percentages
        max_score = max(days_data.values())
        if max_score > 0:
            mindshare_history = [
                [day, (score / max_score) * 100] 
                for day, score in sorted(days_data.items())
            ]
        else:
            mindshare_history = [
                [day, 0] for day in sorted(days_data.keys())
            ]
            
        # Calculate current mindshare (average of last 24 hours)
        current_mindshare = sum(score for _, score in mindshare_history[-4:]) / 4
        
        return {
            'current_mindshare': current_mindshare,
            'mindshare_history': mindshare_history
        }
        
    except Exception as e:
        logger.error(f"Error calculating mindshare metrics: {e}")
        return None

# Add function to get market metrics from CoinGecko API
async def get_market_metrics(symbol):
    """Get market metrics from CoinGecko API"""
    try:
        # CoinGecko API endpoints
        COINGECKO_API = "https://api.coingecko.com/api/v3"
        
        async with aiohttp.ClientSession() as session:
            # Get market information
            async with session.get(
                f"{COINGECKO_API}/coins/bitcoin",
                params={'localization': 'false', 'tickers': 'false'}
            ) as response:
                data = await response.json()
                
                market_data = data.get('market_data', {})
                
                # Get number of holders from blockchain explorers
                async with session.get(
                    "https://api.blockchain.info/stats"
                ) as blockchain_response:
                    blockchain_data = await blockchain_response.json()
                    unique_addresses = blockchain_data.get('n_unique_addresses', 0)
                
                return {
                    'marketCap': market_data.get('market_cap', {}).get('usd', 0) / 1000000,  # Convert to millions
                    'marketCapChange': market_data.get('market_cap_change_percentage_24h', 0),
                    'holders': unique_addresses,
                    'holdersChange': market_data.get('total_volume_change_percentage_24h', 0),
                    'marketCapVsAgents': 0,  # Calculated below
                    'holdersVsAgents': 0,  # Calculated below
                }
                
    except Exception as e:
        logger.error(f"Error fetching market metrics: {e}")
        return None

# Update get_crypto_data function
async def get_crypto_data(symbols):
    """
    Fetch real-time data for BTC including market metrics
    """
    result = []
    current_time = int(datetime.now().timestamp() * 1000)
    
    try:
        symbol = "BTC"
        binance_symbol = f"{symbol}USDT"
        
        try:
            # 1. Get kline (candlestick) data for chart
            kline_url = "https://api.binance.com/api/v3/klines"
            kline_params = {
                "symbol": binance_symbol,
                "interval": "1s",
                "limit": 100
            }
            
            kline_response = requests.get(kline_url, params=kline_params)
            kline_response.raise_for_status()
            kline_data = kline_response.json()
            
            # Convert kline data to sparkline format
            sparkline = [float(candle[4]) for candle in kline_data]
            
            # 2. Get 24h ticker information
            ticker_url = "https://api.binance.com/api/v3/ticker/24hr"
            ticker_params = {
                "symbol": binance_symbol
            }
            
            ticker_response = requests.get(ticker_url, params=ticker_params)
            ticker_response.raise_for_status()
            ticker_data = ticker_response.json()
            
            # 3. Get current price
            price_url = "https://api.binance.com/api/v3/ticker/price"
            price_params = {
                "symbol": binance_symbol
            }
            
            price_response = requests.get(price_url, params=price_params)
            price_response.raise_for_status()
            price_data = price_response.json()
            
            # Calculate price change percentage
            current_price = float(price_data.get('price', 0))
            price_change_24h = float(ticker_data.get('priceChangePercent', 0))
            
            # Calculate 1h price change percentage
            if len(sparkline) >= 60:
                price_1h_ago = sparkline[-60]
                price_change_1h = ((current_price - price_1h_ago) / price_1h_ago) * 100
            else:
                price_change_1h = 0
            
            # Get market metrics from CoinGecko
            market_metrics = await get_market_metrics(symbol)
            
            if market_metrics and twitter_data:
                # Calculate mindshare metrics
                mindshare_data = calculate_mindshare_metrics(
                    twitter_data.get('top_tweets', []), 
                    current_time
                )
                
                if mindshare_data:
                    market_metrics.update({
                        'mindshareHistory': mindshare_data['mindshare_history'],
                        'priceHistory7d': sparkline[-7:] if len(sparkline) >= 7 else sparkline,
                        
                        # Calculate comparison metrics
                        'marketCapVsAgents': (
                            market_metrics['marketCap'] / mindshare_data['current_mindshare'] * 100 - 100
                        ),
                        'holdersVsAgents': (
                            market_metrics['holders'] / mindshare_data['current_mindshare'] * 100 - 100
                        )
                    })
            
            result.append({
                'timestamp': current_time,
                'symbol': symbol,
                'name': 'Bitcoin',
                'current_price': current_price,
                'market_cap': market_metrics.get('marketCap', 0) * 1000000 if market_metrics else 0,
                'volume_24h': float(ticker_data.get('volume', 0)),
                'price_change_1h': price_change_1h,
                'price_change_24h': price_change_24h,
                'price_change_7d': market_metrics.get('marketCapChange', 0) if market_metrics else 0,
                'sparkline': sparkline,
                'last_updated': current_time,
                'market_metrics': market_metrics,
                'twitter_data': twitter_data
            })
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching data for BTC: {e}")
            result.append({
                'timestamp': current_time,
                'symbol': 'BTC',
                'name': 'Bitcoin',
                'current_price': 0,
                'market_cap': 0,
                'volume_24h': 0,
                'price_change_1h': 0,
                'price_change_24h': 0,
                'price_change_7d': 0,
                'sparkline': [0] * 100,
                'last_updated': current_time,
                'market_metrics': None,
                'twitter_data': twitter_data
            })
        
        return result
    
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        return None

# Handle WebSocket connection
async def handle_websocket(websocket):
    logger.info(f"Client connected: {websocket.remote_address}")
    
    # Only track BTC
    crypto_symbols = ['BTC']
    refresh_interval = 1  # Update every 1 second
    
    try:
        # Send Twitter data when client connects
        if twitter_data:
            await websocket.send(json.dumps({
                'type': 'twitter_data',
                'data': twitter_data
            }))
            logger.info("Sent initial Twitter data")
        
        while True:
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                data = json.loads(message)
                
                if data.get('type') == 'dashboard_data':
                    if 'interval' in data:
                        refresh_interval = max(1, min(10, data['interval']))
                        logger.info(f"Updated refresh interval to: {refresh_interval}s")
                elif data.get('type') == 'request_twitter_data':
                    # Resend Twitter data when client requests
                    if twitter_data:
                        await websocket.send(json.dumps({
                            'type': 'twitter_data',
                            'data': twitter_data
                        }))
                        logger.info("Sent Twitter data on request")
            except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                pass
            
            # Get and send crypto data (excluding Twitter data)
            crypto_data = await get_crypto_data(crypto_symbols)
            if crypto_data:
                await websocket.send(json.dumps({
                    'type': 'crypto_data',
                    'data': crypto_data
                }))
                logger.info(f"Sent real-time BTC data")
            
            await asyncio.sleep(refresh_interval)
    
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {websocket.remote_address}")

# Main function to run WebSocket server
async def main():
    host = "localhost"
    port = 8765
    
    logger.info(f"Starting WebSocket server on {host}:{port}")
    async with websockets.serve(handle_websocket, host, port):
        await asyncio.Future()

def get_latest_twitter_file():
    """Get the latest Twitter data file from data/search_results"""
    try:
        data_folder = Path("data/search_results")
        if not data_folder.exists():
            return None
            
        # Get all JSON files in directory
        json_files = list(data_folder.glob("*.json"))
        if not json_files:
            return None
            
        # Get latest file based on modification time
        latest_file = max(json_files, key=lambda x: x.stat().st_mtime)
        return latest_file
        
    except Exception as e:
        logger.error(f"Error finding latest Twitter file: {e}")
        return None

def read_twitter_data_from_file():
    """Read Twitter data from the latest JSON file"""
    try:
        latest_file = get_latest_twitter_file()
        if not latest_file:
            logger.error("No Twitter data file found")
            return None
            
        logger.info(f"Reading Twitter data from {latest_file}")
        with open(latest_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
            
        # Process data from file
        processed_data = process_twitter_data(raw_data)
        if processed_data:
            logger.info("Successfully loaded Twitter data from file")
            return processed_data
        else:
            logger.error("Failed to process Twitter data from file")
            return None
            
    except Exception as e:
        logger.error(f"Error reading Twitter data from file: {e}")
        return None

if __name__ == '__main__':
    # Initialize Twitter data before running server
    twitter_data = init_twitter_data()
    if twitter_data:
        logger.info("Successfully initialized Twitter data")
    else:
        logger.warning("Failed to initialize Twitter data, using empty data")
        twitter_data = None
    
    # Run WebSocket server
    asyncio.run(main())