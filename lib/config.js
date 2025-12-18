const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_PATH = path.join(
  os.homedir(),
  ".node-proxy-enforcer.json"
);

const DEFAULT_CONFIG = {
  httpProxy: "",
  httpsProxy: "",
  whitelist: [],
  blacklist: [],
  disabled: false
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  CONFIG_PATH,
  loadConfig,
  saveConfig
};
