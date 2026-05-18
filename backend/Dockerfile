FROM node:20-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    tesseract-ocr \
    tesseract-ocr-data-spa \
    imagemagick \
    poppler-utils \
    qpdf \
    ghostscript

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

# Stub canvas: pdfjs-dist lo requiere pero no lo usa para texto (pdftotext)
RUN node stub.canvas.js

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]