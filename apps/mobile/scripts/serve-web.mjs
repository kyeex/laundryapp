import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const port = Number.parseInt(process.env.PORT ?? "8088", 10);
const root = resolve(process.argv[2] ?? "dist-check");
const indexFile = join(root, "index.html");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendFile(response, filePath) {
  const extension = extname(filePath);

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function getSafeFilePath(pathname) {
  const decodedPath = decodeURIComponent(pathname.split("?")[0] ?? "/");
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const resolvedPath = resolve(join(root, normalizedPath));

  return resolvedPath === root || resolvedPath.startsWith(`${root}${sep}`)
    ? resolvedPath
    : null;
}

const server = createServer((request, response) => {
  const requestedPath = getSafeFilePath(request.url ?? "/");

  if (!requestedPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const filePath =
    existsSync(requestedPath) && statSync(requestedPath).isDirectory()
      ? join(requestedPath, "index.html")
      : requestedPath;

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(response, filePath);
    return;
  }

  if (existsSync(indexFile)) {
    sendFile(response, indexFile);
    return;
  }

  response.writeHead(404);
  response.end("Build not found. Run the web export first.");
});

server.listen(port, () => {
  console.log(`Serving ${root} with SPA fallback at http://localhost:${port}`);
});
