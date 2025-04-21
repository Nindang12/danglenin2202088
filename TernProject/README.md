# 0xEren

**0xEren** is a real-time cryptocurrency market tracking and analysis app that integrates price data with social media sentiment analysis. It provides in-depth insights into popular cryptocurrencies through price charts, market metrics, and Twitter data analysis to gauge community trends.

## Key Features
- **Real-Time Pricing** 📊: Instant price updates for top cryptocurrencies.
- **Price Charts** 📈: Visualize price trends across multiple timeframes.
- **Market Metrics** 💹: Market cap, trading volume, and other key stats.
- **Twitter Analysis** 🐦: Assess market sentiment using social data.
- **User-Friendly** 🚀: Simple and accessible interface for all users.

## Technologies Used
- **Frontend**: Vite + React + TypeScript + TailwindCSS ⚛️
- **Backend**: Python + Tweepy 🖥️
- **Data Sources**: CoinGecko API 🪙 / Twitter API 🐦

## Installation
1. **Clone the repo**:
   ```bash
   git clone https://github.com/louisdevzz/0xEren.git && cd 0xEren
   ```

2. **Install Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Install dependencies**:
   ```bash
   bun install

4. **Run the backend**:
   ```bash
   cd backend && python3 -m venv venv &&  source venv/bin/activate && pip install -r requirements.txt && cp .env.example .env && python3 dashboard.py
   ```

5. **Run the frontend**:
   ```bash
   cd frontend && bun run dev
   ```

## Usage
- Homepage: View a list of coins with current prices.
- Coin Details: Click to explore charts and Twitter sentiment.
- Customization: Adjust timeframes or filter data.

## Contributing
- Fork the repo.
- Create a branch: git checkout -b feature/feature-name.
- Commit changes: git commit -m "Description".
- Push to branch: git push origin feature/feature-name.
- Create a Pull Request.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For any inquiries or feedback, please contact us at [louisdevzz@slothai.xyz]
(mailto:louisdevzz@slothai.xyz).


