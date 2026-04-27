FROM node:20-alpine

RUN apk add --no-cache \
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
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]