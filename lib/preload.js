const path = require("path");
const { loadConfig } = require("./config");
const { isLocalhostUrl } = require("./isLocalhostUrl");
const { extractUrl, extractUrlForFetch } = require("./extractUrl");

const config = loadConfig();

// Hard disable switch
if (config.disabled === true) {
  return;
}

// ---------- GUARD ----------
function isWhitelisted() {
  const cwd = process.cwd();
  return config.whitelist.some(dir =>
    cwd === dir || cwd.startsWith(dir + path.sep)
  );
}

if (!isWhitelisted()) {
  return;
}

function isBlacklisted() {
  const cwd = process.cwd();
  return config.blacklist.some(dir =>
    cwd === dir || cwd.startsWith(dir + path.sep)
  );
}

if (isBlacklisted()) {
  return;
}

// ---------- PROXY LOGIC ----------

// Clear conflicting envs
// In their presence JS http clients (like Axios) behave in a way
// breaking this override (while still not executing correctly proxied calls).
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.GLOBAL_AGENT_HTTP_PROXY;
// Additional guard preventing applications trying to perform their own
// (likely not working) way of proxying request.
process.env.NO_PROXY='*';

const http = require("http");
const https = require("https");

const { ProxyAgent } = require("undici");

let httpAgent;
let httpsAgent;

if (config.usePacProxyAgent === true) {
  const pacUrl = config.pacUrl;
  if (!pacUrl) {
    throw new Error(
      "PAC mode is enabled but pacUrl is not set. Run `node-proxy-enforcer set-pac-url <pacUrl>` or `node-proxy-enforcer setup`."
    );
  }

  const { PacProxyAgent } = require("pac-proxy-agent");
  const pacAgent = new PacProxyAgent(pacUrl);

  httpAgent = pacAgent;
  httpsAgent = pacAgent;
} else {
  const { HttpProxyAgent } = require("http-proxy-agent");
  const { HttpsProxyAgent } = require("https-proxy-agent");

  httpAgent = new HttpProxyAgent(config.httpProxy);
  httpsAgent = new HttpsProxyAgent(config.httpsProxy);
}

function patchArgs(args, isHttps) {
  const url = extractUrl(args, isHttps);

  if (url && isLocalhostUrl(url)) {
    return;
  }

  const idnexToPatch = typeof args[0] === "object" ? 0 : 1;

  args[idnexToPatch] = {
    ...args[idnexToPatch],
    agent: isHttps ? httpsAgent : httpAgent,
    agents: {
      http: httpAgent,
      https: httpsAgent
    }
  };
}

// ---------- HTTP / HTTPS ----------

const origHttpRequest = http.request;
http.request = function (...args) {
  patchArgs(args, false);
  return origHttpRequest.apply(this, args);
};

const origHttpsRequest = https.request;
https.request = function (...args) {
  patchArgs(args, true);
  return origHttpsRequest.apply(this, args);
};

const origHttpsGet = https.get;
https.get = function (...args) {
  patchArgs(args, true);
  return origHttpsGet.apply(this, args);
};

// ---------- FETCH (UNDICI) ----------

const originalFetch = globalThis.fetch;

function parsePacResult(result) {
  const proxies = String(result || "DIRECT")
    .trim()
    .split(/\s*;\s*/g)
    .filter(Boolean);

  for (const proxy of proxies) {
    const [rawType, target] = proxy.split(/\s+/);
    const type = (rawType || "").toUpperCase();

    if (type === "DIRECT") {
      return { type: "DIRECT" };
    }

    // For fetch we only support HTTP(S) proxies via undici.ProxyAgent.
    if (type === "PROXY" || type === "HTTP" || type === "HTTPS") {
      const scheme = type === "HTTPS" ? "https" : "http";
      if (!target) continue;
      return { type: "PROXY", proxyUrl: `${scheme}://${target}` };
    }
  }

  return { type: "UNSUPPORTED", raw: String(result || "") };
}

if (config.usePacProxyAgent === true) {
  const dispatcherCache = new Map();
  let resolverPromise;

  globalThis.fetch = function (input, init = {}) {
    const url = extractUrlForFetch(input);

    if (url && isLocalhostUrl(url)) {
      return originalFetch(input, init);
    }

    return (async () => {
      if (!resolverPromise) {
        resolverPromise = pacAgent.getResolver();
      }

      const resolver = await resolverPromise;
      const result = await resolver(new URL(url));
      const parsed = parsePacResult(result);

      if (parsed.type === "DIRECT") {
        return originalFetch(input, init);
      }

      if (parsed.type === "PROXY") {
        let dispatcher = dispatcherCache.get(parsed.proxyUrl);
        if (!dispatcher) {
          dispatcher = new ProxyAgent(parsed.proxyUrl);
          dispatcherCache.set(parsed.proxyUrl, dispatcher);
        }

        return originalFetch(input, {
          ...init,
          dispatcher
        });
      }

      throw new Error(
        `PAC returned unsupported proxy directive for fetch: ${parsed.raw}`
      );
    })();
  };
} else {
  const dispatcher = new ProxyAgent(config.httpsProxy);

  globalThis.fetch = function (input, init = {}) {
    const url = extractUrlForFetch(input);

    if (url && isLocalhostUrl(url)) {
      return originalFetch(input, init);
    }

    return originalFetch(input, {
      ...init,
      dispatcher
    });
  };
}
