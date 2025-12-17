const path = require("path");
const { loadConfig } = require("./config");

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

console.log('>> running override')

// ---------- PROXY LOGIC ----------

// Clear conflicting envs
// In their presence JS http clients (like Axios) behave in a way
// breaking this override (while still not executing correctly proxied calls).
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.GLOBAL_AGENT_HTTP_PROXY;

const http = require("http");
const https = require("https");

const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { ProxyAgent } = require("undici");

const httpAgent = new HttpProxyAgent(config.httpProxy);
const httpsAgent = new HttpsProxyAgent(config.httpsProxy);

function patchArgs(args, isHttps) {
  if (typeof args[0] !== "object") {
    args[0] = {
      url: args[0],
      agent: isHttps ? httpsAgent : httpAgent
    };
  } else {
    args[0] = {
      ...args[0],
      agent: isHttps ? httpsAgent : httpAgent,
      agents: {
        http: httpAgent,
        https: httpsAgent
      }
    };
  }
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
  return originalFetch(input, {
    ...init,
    dispatcher
  });
};
