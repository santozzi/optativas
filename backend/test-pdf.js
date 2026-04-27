const fs = require('fs');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.js');

async function run() {
  const data = new Uint8Array(fs.readFileSync('./test.pdf'));
  const pdf = await getDocument(data).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + ' ';
  }
  fs.writeFileSync('/tmp/pdf_final.txt', text);
  console.error('Done!');
}

run().catch(e => console.error('Error:', e));