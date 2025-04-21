import requests, zipfile, io

# URL của GloVe
url = "http://nlp.stanford.edu/data/glove.6B.zip"

print("🔽 Đang tải GloVe...")
r = requests.get(url)
z = zipfile.ZipFile(io.BytesIO(r.content))
z.extractall("glove")  # Giải nén vào thư mục 'glove'
print("✅ Tải và giải nén xong!")
