const Busboy = require('busboy');

function parseMultipart(req, { maxFileBytes = 4.5 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: maxFileBytes } });
    const fields = {};
    const files = {};
    let tooLargeField = null;

    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('limit', () => {
        tooLargeField = name;
      });
      file.on('end', () => {
        if (tooLargeField === name) return;
        files[name] = {
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimeType: info.mimeType,
        };
      });
    });

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('error', (err) => reject(err));
    bb.on('finish', () => {
      if (tooLargeField) {
        return reject(
          Object.assign(new Error(`File "${tooLargeField}" exceeds the size limit`), {
            statusCode: 413,
          })
        );
      }
      resolve({ fields, files });
    });

    req.pipe(bb);
  });
}

module.exports = { parseMultipart };
