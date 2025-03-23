import streamlit as st
import pandas as pd
import plotly.express as px
import requests
from datetime import datetime
import time

# Hàm lấy dữ liệu thời gian thực từ CoinGecko
@st.cache_data(ttl=30)  # Cache dữ liệu trong 30 giây để cập nhật thường xuyên
def get_crypto_data(symbols):
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
        'sparkline': 'true',  # Đảm bảo tham số là string 'true'
        'price_change_percentage': '1h,24h,7d'  # Thay đổi giá trong 1h, 24h, 7d
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 429:
            st.warning("Rate limit hit. Waiting to retry...")
            time.sleep(60)
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
                'sparkline': sparkline_data if sparkline_data else [],  # Nếu không có thì trả về danh sách rỗng
                'last_updated': coin['last_updated']
            })
        
        return pd.DataFrame(result)
    
    except requests.exceptions.RequestException as e:
        st.error(f"Error fetching data: {e}")
        return None

# Hàm chính
def main():
    st.title('Real-time Cryptocurrency Dashboard')
    st.write('Visualizing real-time changes of cryptocurrency tokens')

    # Danh sách token mặc định
    crypto_symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT']
    
    # Sidebar chọn token
    st.sidebar.header('Settings')
    selected_cryptos = st.sidebar.multiselect(
        'Select cryptocurrencies to monitor',
        crypto_symbols,
        default=['BTC', 'ETH', 'SOL']
    )
    
    refresh_interval = st.sidebar.slider(
        'Refresh interval (seconds)',
        10, 120, 30
    )

    if not selected_cryptos:
        st.warning("Please select at least one cryptocurrency")
        return
    
    # Placeholder để cập nhật dữ liệu
    placeholder = st.empty()
    
    while True:
        # Lấy dữ liệu thời gian thực
        crypto_data = get_crypto_data(selected_cryptos)
        
        if crypto_data is not None:
            with placeholder.container():
                # Hiển thị giá hiện tại
                st.subheader('Current Prices')
                cols = st.columns(len(crypto_data))
                for i, (_, row) in enumerate(crypto_data.iterrows()):
                    with cols[i]:
                        price = row['current_price']
                        price_change = row['price_change_24h']
                        delta_color = "normal" if price_change >= 0 else "inverse"
                        
                        # Định dạng giá
                        price_display = (
                            f"${price:,.0f}" if price >= 1000 else
                            f"${price:.2f}" if price >= 1 else
                            f"${price:.4f}"
                        )
                        
                        st.metric(
                            label=f"{row['name']} ({row['symbol']})",
                            value=price_display,
                            delta=f"{price_change:.2f}%",
                            delta_color=delta_color
                        )
                
                # Biểu đồ giá thay đổi ngắn hạn (sparkline)
                st.subheader('Price Trends (Last 7 Days)')
                for _, row in crypto_data.iterrows():
                    if row['sparkline']:  # Chỉ vẽ nếu có dữ liệu sparkline
                        fig = px.line(
                            y=row['sparkline'],
                            title=f"{row['name']} ({row['symbol']}) Price Trend",
                            labels={'y': 'Price (USD)', 'x': 'Time'}
                        )
                        fig.update_layout(showlegend=False)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        st.write(f"No sparkline data available for {row['name']} ({row['symbol']})")
                
                # Biểu đồ thay đổi giá (1h, 24h, 7d)
                st.subheader('Price Change Comparison')
                melted_df = crypto_data.melt(
                    id_vars=['symbol'],
                    value_vars=['price_change_1h', 'price_change_24h', 'price_change_7d'],
                    var_name='period',
                    value_name='change'
                )
                fig = px.bar(
                    melted_df,
                    x='symbol',
                    y='change',
                    color='period',
                    barmode='group',
                    title='Price Change Over Time',
                    labels={'change': 'Price Change (%)', 'symbol': 'Cryptocurrency'}
                )
                st.plotly_chart(fig)
                
                # Biểu đồ phân phối Market Cap
                st.subheader('Market Capitalization Distribution')
                fig = px.pie(
                    crypto_data,
                    values='market_cap',
                    names='symbol',
                    title='Market Cap Distribution',
                    hole=0.4
                )
                st.plotly_chart(fig)
                
                # Thông tin cập nhật
                st.info(f"Data last updated: {crypto_data['timestamp'].iloc[0]}")
        
        # Tự động làm mới sau khoảng thời gian
        time.sleep(refresh_interval)
        st.cache_data.clear()  # Xóa cache để lấy dữ liệu mới
        st.rerun()

if __name__ == '__main__':
    main()