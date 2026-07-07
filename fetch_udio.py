import urllib.request
import re

url = "https://www.udio.com/songs/dmw5hJXuRy2QXiHW3FwUig"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    links = re.findall(r'https?://[^\s\"\']+\.(?:mp3|wav|m4a|aac)', html)
    
    # Udio often stores media in nextjs props or json chunks.
    # Let's also look for media URLs directly
    links2 = re.findall(r'https?://[^\s\"\']+(?:audio|media)[^\s\"\']+', html)
    
    # Or look for songPath
    song_paths = re.findall(r'\"songPath\"[^:]*:\"([^\"]+)\"', html)
    
    print("Found direct links:", set(links))
    print("Found media links:", set(links2))
    print("Found song paths:", set(song_paths))
except Exception as e:
    print(f"Error: {e}")
