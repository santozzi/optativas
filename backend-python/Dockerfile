FROM python:3.12-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq \
    tesseract-ocr tesseract-ocr-spa \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app.run:app"]