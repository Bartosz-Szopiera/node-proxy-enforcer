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

const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { ProxyAgent } = require("undici");

const httpAgent = new HttpProxyAgent(config.httpProxy);
const httpsAgent = new HttpsProxyAgent(config.httpsProxy);

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

// http / https
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

// fetch (undici)
const originalFetch = globalThis.fetch;
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
