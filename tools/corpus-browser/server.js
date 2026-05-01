const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const DEFAULT_PORT = 4173;
const browserRoot = __dirname;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const corpusDir = path.resolve(options.corpusDir);
  await ensureDirectory(corpusDir);

  const server = http.createServer((request, response) => {
    handleRequest(request, response, {
      corpusDir,
      port: options.port,
    }).catch((error) => {
      console.error(error);
      sendText(response, 500, `Internal server error\n${String(error.message || error)}`);
    });
  });

  server.listen(options.port, "127.0.0.1", () => {
    console.log(`Corpus browser listening on http://127.0.0.1:${options.port}`);
    console.log(`Serving corpus from ${corpusDir}`);
  });
}

function parseArgs(argv) {
  const options = {
    corpusDir: "./corpus",
    port: DEFAULT_PORT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === "help") {
      printHelpAndExit();
    }

    const rawValue = argv[index + 1];
    if (!rawValue || rawValue.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case "corpus":
        options.corpusDir = rawValue;
        break;
      case "port":
        options.port = parsePort(rawValue);
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  return options;
}

function printHelpAndExit() {
  console.log(`Usage:
  npm run browse:corpus -- --corpus ./corpus

Options:
  --corpus <dir>    Corpus output directory to serve
  --port <n>        Local HTTP port (default: ${DEFAULT_PORT})
  --help            Print this message`);
  process.exit(0);
}

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

async function ensureDirectory(dirPath) {
  const stat = await fs.stat(dirPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Corpus directory not found: ${dirPath}`);
  }
}

async function handleRequest(request, response, options) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/__browser-config.json") {
    sendJson(response, 200, {
      corpusBaseUrl: "/corpus",
      corpusPath: options.corpusDir,
      port: options.port,
    });
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    await sendFile(response, path.join(browserRoot, "index.html"));
    return;
  }

  if (pathname.startsWith("/corpus/")) {
    const filePath = safeJoin(options.corpusDir, pathname.slice("/corpus/".length));
    await sendFile(response, filePath);
    return;
  }

  const browserPath = safeJoin(browserRoot, pathname.replace(/^\//, ""));
  await sendFile(response, browserPath);
}

function safeJoin(rootDir, relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const normalizedRoot = `${path.resolve(rootDir)}${path.sep}`;
  if (resolved !== path.resolve(rootDir) && !resolved.startsWith(normalizedRoot)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  return resolved;
}

async function sendFile(response, filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    sendText(response, 404, `Not found: ${filePath}`);
    return;
  }

  const body = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": body.byteLength,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.byteLength,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  const body = Buffer.from(`${text}\n`, "utf8");
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.byteLength,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".wav":
      return "audio/wav";
    case ".mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
