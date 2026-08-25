import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end("not found");
      return;
    }
    response.setHeader("Content-Type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    response.end(data);
  });
}).listen(4173, "127.0.0.1");
