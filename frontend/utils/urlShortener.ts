// URL shortening utility
export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    // Using TinyURL API (free, no API key required)
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    const shortUrl = await response.text();
    
    if (shortUrl.startsWith('http')) {
      return shortUrl;
    }
    
    // Fallback to original URL if shortening fails
    return longUrl;
  } catch (error) {
    console.error('URL shortening failed:', error);
    return longUrl;
  }
}