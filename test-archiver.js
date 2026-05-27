const archiver = require('archiver');
const fs = require('fs');

async function run() {
  const chunks = [];
  const archive = archiver('zip', { zlib: { level: 9 } });

  const streamPromise = new Promise((resolve, reject) => {
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', err => reject(err));
  });

  archive.append('hello world', { name: 'hello.txt' });
  archive.finalize();

  const buf = await streamPromise;
  console.log("Done, buffer length:", buf.length);
}

run().catch(console.error);
