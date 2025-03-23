import asyncio
import json
import websockets
import pandas as pd
import requests
from datetime import datetime
import time
import logging
import redis

# Thiết lập logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Kết nối Redis
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
CACHE_EXPIRY = 60 * 15  # 15 phút

# Hàm lấy dữ liệu thời gian thực từ CoinGecko
async def get_crypto_data(symbols):
    """
    Fetch real-time data for multiple cryptocurrencies using CoinGecko API.
    """
    symbol_mapping = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'SOL': 'solana',
        'XRP': 'ripple',
        'DOGE': 'dogecoin',
        'ADA': 'cardano',
        'AVAX': 'avalanche-2',
        'DOT': 'polkadot',
    }
    
    # Chuyển đổi ticker symbols thành CoinGecko IDs
    coin_ids = [symbol_mapping.get(symbol.upper(), symbol.lower()) for symbol in symbols]
    coin_list = ','.join(coin_ids)
    
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        'vs_currency': 'usd',
        'ids': coin_list,
        'order': 'market_cap_desc',
        'per_page': 100,
        'page': 1,
        'sparkline': 'true',
        'price_change_percentage': '1h,24h,7d'
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 429:
            logger.warning("Rate limit hit. Waiting to retry...")
            await asyncio.sleep(60)
            response = requests.get(url, params=params)
        
        response.raise_for_status()
        data = response.json()
        
        result = []
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        for coin in data:
            # Kiểm tra xem sparkline_in_7d có tồn tại không
            sparkline_data = coin.get('sparkline_in_7d', {}).get('price', None)
            
            result.append({
                'timestamp': current_time,
                'symbol': coin['symbol'].upper(),
                'name': coin['name'],
                'current_price': coin['current_price'],
                'market_cap': coin['market_cap'],
                'volume_24h': coin['total_volume'],
                'price_change_1h': coin.get('price_change_percentage_1h_in_currency', 0),
                'price_change_24h': coin.get('price_change_percentage_24h_in_currency', 0),
                'price_change_7d': coin.get('price_change_percentage_7d_in_currency', 0),
                'sparkline': sparkline_data if sparkline_data else [],
                'last_updated': coin['last_updated']
            })
        
        return result
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching data: {e}")
        return None

# Xử lý kết nối WebSocket
async def handle_websocket(websocket):
    logger.info(f"Client connected: {websocket.remote_address}")
    
    # Mặc định theo dõi các token này
    crypto_symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'DOGE', 'USDT']
    refresh_interval = 30  # Mặc định 30 giây
    
    try:
        # Vòng lặp xử lý tin nhắn và gửi dữ liệu
        while True:
            # Kiểm tra xem có tin nhắn mới không (non-blocking)
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                try:
                    data = json.loads(message)
                    if 'symbols' in data:
                        crypto_symbols = data['symbols']
                        logger.info(f"Updated symbols to: {crypto_symbols}")
                    if 'interval' in data:
                        refresh_interval = max(10, min(120, data['interval']))  # Giới hạn từ 10-120s
                        logger.info(f"Updated refresh interval to: {refresh_interval}s")
                except json.JSONDecodeError:
                    logger.error("Received invalid JSON")
            except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                # Không có tin nhắn mới hoặc kết nối đã đóng
                pass
            
            # Lấy và gửi dữ liệu crypto
            crypto_data = await get_crypto_data(crypto_symbols)
            if crypto_data:
                await websocket.send(json.dumps(crypto_data))
                logger.info(f"Sent data for {len(crypto_data)} cryptocurrencies")
            
            # Đợi đến lần cập nhật tiếp theo
            await asyncio.sleep(refresh_interval)
    
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {websocket.remote_address}")

# Hàm chính để chạy WebSocket server
async def main():
    host = "localhost"
    port = 8765
    
    logger.info(f"Starting WebSocket server on {host}:{port}")
    async with websockets.serve(handle_websocket, host, port):
        await asyncio.Future()  # Chạy mãi mãi

if __name__ == '__main__':
    asyncio.run(main())