import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from twitter.search import Search
from httpx import Client
import asyncio

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get Twitter credentials from environment variables
email = os.getenv("TWITTER_EMAIL")
username = os.getenv("TWITTER_USERNAME")
password = os.getenv("TWITTER_PASSWORD")

logger.info(f"Using Twitter account: {username}")

async def init_twitter_search():
    try:
        # Check if session file exists
        session_file = Path("twitter_session.cookies")
        
        if session_file.exists():
            logger.info("Using existing session file")
            search = Search(cookies="twitter_session.cookies", debug=2)
        else:
            logger.info("No session file found, using direct login")
            # Tạo search instance với credentials
            search = Search(email, username, password, debug=2)
            
            # Thực hiện login
            await search.login()
            
            # Lưu cookies sau khi login thành công
            search.save_cookies("twitter_session.cookies")
            logger.info("Session saved to twitter_session.cookies")
        
        return search
        
    except Exception as e:
        logger.error(f"Error initializing Twitter search: {e}")
        return None

async def test_search():
    try:
        search = await init_twitter_search()
        if not search:
            logger.error("Failed to initialize Twitter search")
            return
        
        logger.info("Testing search functionality...")
        results = await search.process(
            queries=[
                {
                    'category': 'Top',
                    'query': 'crypto BTC bitcoin'
                }
            ],
            limit=10,
            retries=3
        )
        
        if results and len(results) > 0:
            logger.info(f"Successfully retrieved {len(results[0])} tweets")
            # Lưu kết quả test vào file
            with open('test_tweets.json', 'w', encoding='utf-8') as f:
                json.dump(results[0], f, ensure_ascii=False, indent=2)
            logger.info("Test results saved to test_tweets.json")
        else:
            logger.error("No tweets found in test search")
            
    except Exception as e:
        logger.error(f"Error during test search: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())
    