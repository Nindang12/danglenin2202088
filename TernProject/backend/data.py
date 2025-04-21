import requests
import pandas as pd
import time
import os
from datetime import datetime

def get_crypto_data(symbols):
    """
    Fetch real-time data for multiple cryptocurrencies using CoinGecko API.
    
    Args:
        symbols (list): List of cryptocurrency symbols (e.g., ['bitcoin', 'ethereum'])
    
    Returns:
        pandas.DataFrame: DataFrame containing the price data
    """
    # Convert common ticker symbols to CoinGecko IDs if needed
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
        'LINK': 'chainlink',
        'MATIC': 'matic-network',
        'UNI': 'uniswap',
        'LTC': 'litecoin',
        'ATOM': 'cosmos',
        'SHIB': 'shiba-inu',
        'XLM': 'stellar',
        'ALGO': 'algorand',
        'NEAR': 'near',
        'FIL': 'filecoin',
        'ETC': 'ethereum-classic',
        'ICP': 'internet-computer',
        'VET': 'vechain',
        'FLOW': 'flow',
        'XMR': 'monero',
        'HBAR': 'hedera-hashgraph',
        'XTZ': 'tezos',
        'SAND': 'the-sandbox',
        'MANA': 'decentraland',
        'AAVE': 'aave',
    }
    
    # Convert ticker symbols to CoinGecko IDs if necessary
    coin_ids = []
    for symbol in symbols:
        if symbol.upper() in symbol_mapping:
            coin_ids.append(symbol_mapping[symbol.upper()])
        else:
            coin_ids.append(symbol.lower())
    
    # Construct the API URL with the required parameters
    coin_list = ','.join(coin_ids)
    url = f"https://api.coingecko.com/api/v3/coins/markets"
    params = {
        'vs_currency': 'usd',
        'ids': coin_list,
        'order': 'market_cap_desc',
        'per_page': 100,
        'page': 1,
        'sparkline': False,
        'price_change_percentage': '24h'
    }
    
    try:
        response = requests.get(url, params=params)
        
        # Check if rate limit was hit
        if response.status_code == 429:
            print("Rate limit hit. Waiting to retry...")
            time.sleep(60)  # Wait 60 seconds before retrying
            response = requests.get(url, params=params)
        
        response.raise_for_status()  # Raise an exception for HTTP errors
        data = response.json()
        
        # Extract relevant information
        result = []
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        for coin in data:
            result.append({
                'timestamp': current_time,
                'symbol': coin['symbol'].upper(),
                'name': coin['name'],
                'current_price': coin['current_price'],
                'market_cap': coin['market_cap'],
                'volume_24h': coin['total_volume'],
                'price_change_24h': coin['price_change_percentage_24h'],
                'last_updated': coin['last_updated']
            })
        
        return pd.DataFrame(result)
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

def save_to_csv(df, file_path, mode='a'):
    """
    Save DataFrame to CSV file.
    
    Args:
        df (pandas.DataFrame): DataFrame to save
        file_path (str): Path to the CSV file
        mode (str): File mode - 'a' for append, 'w' for write
    """
    # Check if file exists to determine if we need to write headers
    file_exists = os.path.isfile(file_path)
    
    # Save to CSV
    df.to_csv(file_path, mode=mode, header=not file_exists if mode == 'a' else True, index=False)
    
    print(f"Data saved to {file_path}")

def monitor_and_save_crypto_prices(symbols, csv_file='crypto_prices.csv', interval=10, duration=None):
    """
    Continuously monitor cryptocurrency prices and save to CSV at specified intervals.
    
    Args:
        symbols (list): List of cryptocurrency symbols to monitor
        csv_file (str): Path to the CSV file to save data
        interval (int): Time interval between updates in seconds (default: 10)
        duration (int, optional): Total duration to run in minutes (None for indefinite)
    """
    count = 0
    max_count = None if duration is None else (duration * 60) // interval
    
    # Create an empty CSV file with headers if it doesn't exist
    if not os.path.exists(csv_file):
        headers_df = pd.DataFrame(columns=[
            'timestamp', 'symbol', 'name', 'current_price', 
            'market_cap', 'volume_24h', 'price_change_24h', 'last_updated'
        ])
        headers_df.to_csv(csv_file, index=False)
        print(f"Created new CSV file: {csv_file}")
    
    try:
        while max_count is None or count < max_count:
            # Get current timestamp
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"Cryptocurrency Price Update - {now}")
            
            # Fetch data
            df = get_crypto_data(symbols)
            if df is not None:
                # Save to CSV
                save_to_csv(df, csv_file)
                
                # Display sample of the data
                print("\nLatest data sample:")
                display_df = df.copy()
                display_df['current_price'] = display_df['current_price'].apply(lambda x: f"${x:,.2f}")
                print(display_df[['symbol', 'current_price', 'price_change_24h']].head(5))
                
                print(f"\nUpdating again in {interval} seconds (Press Ctrl+C to exit)...")
            else:
                print("Failed to fetch data. Retrying...")
            
            # Wait for the next update
            time.sleep(interval)
            count += 1
            
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user.")
        print(f"Data has been saved to {csv_file}")

# Example usage
if __name__ == "__main__":
    # List of cryptocurrencies to monitor
    crypto_symbols = [
        'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 
        'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT',
        'LINK', 'MATIC', 'UNI', 'LTC', 'ATOM',
        'SHIB', 'XLM', 'ALGO', 'NEAR', 'FIL',
        'ETC', 'ICP', 'VET', 'FLOW', 'XMR',
        'HBAR', 'XTZ', 'SAND', 'MANA', 'AAVE'
    ]
    
    # Start monitoring with updates every 10 seconds and save to CSV
    monitor_and_save_crypto_prices(crypto_symbols, csv_file='crypto_prices.csv', interval=10)