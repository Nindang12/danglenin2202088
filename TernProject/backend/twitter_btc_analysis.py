import json
import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords

# Download NLTK resources if not already available
nltk.download('stopwords')
nltk.download('punkt')

def load_tweet_data(directory='data/search_results'):
    """Load all tweet JSON files from the specified directory."""
    tweets_data = []
    
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            file_path = os.path.join(directory, filename)
            with open(file_path, 'r', encoding='utf-8') as file:
                try:
                    data = json.load(file)
                    # If the data is a list of tweets
                    if isinstance(data, list):
                        tweets_data.extend(data)
                except json.JSONDecodeError:
                    print(f"Error decoding JSON from {filename}")
    
    return tweets_data

def extract_tweet_info(tweets_data):
    """Extract relevant information from tweet data."""
    extracted_data = []
    
    for tweet in tweets_data:
        try:
            # Extract the tweet content object
            tweet_content = tweet.get('content', {}).get('itemContent', {}).get('tweet_results', {}).get('result', {})
            
            if not tweet_content:
                continue
                
            # Get legacy data which contains most of the tweet information
            legacy_data = tweet_content.get('legacy', {})
            
            # Get user data
            user_data = tweet_content.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {})
            
            # Extract text content
            full_text = legacy_data.get('full_text', '')
            
            # Check if there's a note tweet with more content
            note_tweet = tweet_content.get('note_tweet', {}).get('note_tweet_results', {}).get('result', {})
            if note_tweet and 'text' in note_tweet:
                full_text = note_tweet.get('text', '')
            
            # Extract engagement metrics
            favorite_count = int(legacy_data.get('favorite_count', 0))
            retweet_count = int(legacy_data.get('retweet_count', 0))
            reply_count = int(legacy_data.get('reply_count', 0))
            quote_count = int(legacy_data.get('quote_count', 0))
            
            # Get view count if available
            views = tweet_content.get('views', {})
            view_count = int(views.get('count', 0)) if views.get('count', '').isdigit() else 0
            
            # Extract timestamp and convert to datetime
            created_at = legacy_data.get('created_at', '')
            if created_at:
                # Twitter's timestamp format: "Sat Mar 01 16:16:54 +0000 2025"
                created_datetime = datetime.strptime(created_at, '%a %b %d %H:%M:%S +0000 %Y')
            else:
                created_datetime = None
            
            # Extract hashtags
            hashtags = [tag['text'].lower() for tag in legacy_data.get('entities', {}).get('hashtags', [])]
            
            # Extract symbols (like $BTC)
            symbols = [symbol['text'].upper() for symbol in legacy_data.get('entities', {}).get('symbols', [])]
            
            # Extract user information
            username = user_data.get('screen_name', '')
            display_name = user_data.get('name', '')
            followers_count = int(user_data.get('followers_count', 0))
            
            # Append to our extracted data
            extracted_data.append({
                'text': full_text,
                'created_at': created_datetime,
                'favorite_count': favorite_count,
                'retweet_count': retweet_count,
                'reply_count': reply_count,
                'quote_count': quote_count,
                'view_count': view_count,
                'engagement_total': favorite_count + retweet_count + reply_count + quote_count,
                'hashtags': hashtags,
                'symbols': symbols,
                'username': username,
                'display_name': display_name,
                'followers_count': followers_count
            })
            
        except Exception as e:
            print(f"Error processing tweet: {e}")
    
    return extracted_data

def create_dataframe(extracted_data):
    """Convert extracted data to a pandas DataFrame."""
    df = pd.DataFrame(extracted_data)
    return df

def analyze_tweet_content(df):
    """Analyze tweet content for common words, topics, etc."""
    # Combine all tweet text
    all_text = ' '.join(df['text'].tolist())
    
    # Clean text - remove URLs, mentions, special chars
    all_text = re.sub(r'http\S+', '', all_text)
    all_text = re.sub(r'@\w+', '', all_text)
    all_text = re.sub(r'[^\w\s]', '', all_text)
    all_text = all_text.lower()
    
    # Tokenize bằng cách đơn giản (không dùng nltk.word_tokenize)
    words = all_text.split()
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    filtered_words = [word for word in words if word not in stop_words and len(word) > 2]
    
    # Count word frequencies
    word_freq = Counter(filtered_words)
    
    # Get most common words
    common_words = word_freq.most_common(20)
    
    return common_words

def analyze_hashtags(df):
    """Analyze hashtag usage."""
    # Flatten the list of hashtags
    all_hashtags = [tag for sublist in df['hashtags'] for tag in sublist]
    
    # Count hashtag frequencies
    hashtag_freq = Counter(all_hashtags)
    
    # Get most common hashtags
    common_hashtags = hashtag_freq.most_common(15)
    
    return common_hashtags

def analyze_symbols(df):
    """Analyze symbol usage (like $BTC)."""
    # Flatten the list of symbols
    all_symbols = [symbol for sublist in df['symbols'] for symbol in sublist]
    
    # Count symbol frequencies
    symbol_freq = Counter(all_symbols)
    
    # Get most common symbols
    common_symbols = symbol_freq.most_common(10)
    
    return common_symbols

def visualize_data(df, common_words, common_hashtags, common_symbols):
    """Create visualizations from the analyzed data."""
    # Set the style
    sns.set(style="whitegrid")
    
    # Create a directory for visualizations
    os.makedirs('visualizations', exist_ok=True)
    
    # 1. Engagement distribution
    plt.figure(figsize=(12, 6))
    sns.histplot(df['engagement_total'], bins=30, kde=True)
    plt.title('Distribution of Tweet Engagement')
    plt.xlabel('Total Engagement (Likes + Retweets + Replies + Quotes)')
    plt.ylabel('Number of Tweets')
    plt.tight_layout()
    plt.savefig('visualizations/engagement_distribution.png')
    plt.close()
    
    # 2. Top words bar chart
    plt.figure(figsize=(14, 8))
    words, counts = zip(*common_words)
    sns.barplot(x=list(counts), y=list(words))
    plt.title('Most Common Words in BTC Tweets')
    plt.xlabel('Count')
    plt.ylabel('Word')
    plt.tight_layout()
    plt.savefig('visualizations/common_words.png')
    plt.close()
    
    # 3. Top hashtags bar chart
    plt.figure(figsize=(14, 8))
    if common_hashtags:
        tags, tag_counts = zip(*common_hashtags)
        sns.barplot(x=list(tag_counts), y=list(tags))
        plt.title('Most Common Hashtags in BTC Tweets')
        plt.xlabel('Count')
        plt.ylabel('Hashtag')
        plt.tight_layout()
        plt.savefig('visualizations/common_hashtags.png')
    plt.close()
    
    # 4. Top symbols bar chart
    plt.figure(figsize=(12, 6))
    if common_symbols:
        symbols, symbol_counts = zip(*common_symbols)
        sns.barplot(x=list(symbols), y=list(symbol_counts))
        plt.title('Most Common Symbols in BTC Tweets (like $BTC)')
        plt.xlabel('Symbol')
        plt.ylabel('Count')
        plt.tight_layout()
        plt.savefig('visualizations/common_symbols.png')
    plt.close()
    
    # 5. Engagement by time
    plt.figure(figsize=(14, 7))
    df['date'] = df['created_at'].dt.date
    engagement_by_date = df.groupby('date')['engagement_total'].mean().reset_index()
    sns.lineplot(data=engagement_by_date, x='date', y='engagement_total')
    plt.title('Average Engagement by Date')
    plt.xlabel('Date')
    plt.ylabel('Average Engagement')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/engagement_by_date.png')
    plt.close()
    
    # 6. Top influencers by followers
    plt.figure(figsize=(14, 8))
    top_influencers = df.sort_values('followers_count', ascending=False).head(15)
    sns.barplot(x='followers_count', y='username', data=top_influencers)
    plt.title('Top Bitcoin Influencers by Follower Count')
    plt.xlabel('Follower Count')
    plt.ylabel('Username')
    plt.tight_layout()
    plt.savefig('visualizations/top_influencers.png')
    plt.close()
    
    # 7. Correlation heatmap of engagement metrics
    plt.figure(figsize=(10, 8))
    engagement_cols = ['favorite_count', 'retweet_count', 'reply_count', 'quote_count', 'view_count']
    correlation = df[engagement_cols].corr()
    sns.heatmap(correlation, annot=True, cmap='coolwarm')
    plt.title('Correlation Between Engagement Metrics')
    plt.tight_layout()
    plt.savefig('visualizations/engagement_correlation.png')
    plt.close()

def main():
    # Load tweet data
    tweets_data = load_tweet_data()
    print(f"Loaded {len(tweets_data)} tweets")
    
    # Extract relevant information
    extracted_data = extract_tweet_info(tweets_data)
    print(f"Extracted information from {len(extracted_data)} tweets")
    
    # Create DataFrame
    df = create_dataframe(extracted_data)
    
    # Analyze content
    common_words = analyze_tweet_content(df)
    common_hashtags = analyze_hashtags(df)
    common_symbols = analyze_symbols(df)
    
    # Create visualizations
    visualize_data(df, common_words, common_hashtags, common_symbols)
    print("Visualizations created in the 'visualizations' directory")
    
    # Save processed data
    df.to_csv('btc_tweets_processed.csv', index=False)
    print("Processed data saved to 'btc_tweets_processed.csv'")

if __name__ == "__main__":
    main() 