#!/usr/bin/env node

const { program } = require("commander");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { CONFIG_PATH, loadConfig, saveConfig } = require("../lib/config");
const { ask } = require("../lib/prompt");
const { isValidProxyUrl } = require("../lib/validate");

const PRELOAD_PATH = path.resolve(__dirname, "../lib/preload.js");

async function askForValidProxy(label) {
  while (true) {
    const value = await ask(label);
    if (isValidProxyUrl(value)) return value;

    console.log(
      "Invalid proxy format. Expected e.g. http://proxy.company.com:8080"
    );
  }
}

async function configureProxies() {
  const httpsProxy = await askForValidProxy(
    "Enter HTTPS proxy address: "
  );

  let httpProxy;
  while (true) {
    const input = await ask(
      "Enter HTTP proxy address (leave empty to use HTTPS proxy): "
    );

    if (!input) {
      httpProxy = httpsProxy;
      break;
    }

    if (isValidProxyUrl(input)) {
      httpProxy = input;
      break;
    }

    console.log(
      "Invalid proxy format. Expected e.g. http://proxy.company.com:8080"
    );
  }

  const config = loadConfig();
  config.httpsProxy = httpsProxy;
  config.httpProxy = httpProxy;

  saveConfig(config);

  console.log("\nProxy configuration saved:");
  console.log("  HTTPS:", httpsProxy);
  console.log("  HTTP :", httpProxy);
}

function whitelistDir(dir) {
  const config = loadConfig();
  const resolved = path.resolve(dir);

  if (!config.whitelist.includes(resolved)) {
    config.whitelist.push(resolved);
    saveConfig(config);
    console.log("Added:", resolved);
  } else {
    console.log("Already whitelisted.");
  }
}

function blacklistDir(dir) {
  const config = loadConfig();
  const resolved = path.resolve(dir);

  if (!config.blacklist.includes(resolved)) {
    config.blacklist.push(resolved);
    saveConfig(config);
    console.log("Added:", resolved);
  } else {
    console.log("Already blacklisted.");
  }
}

function getEnvSetupText() {
  return [
    "Add the following line to your shell config:",
    `\nexport NODE_OPTIONS="--require=${PRELOAD_PATH}"`,
    "\nTypical files:",
    "  ~/.bashrc",
    "  ~/.zshrc",
    "  ~/.profile\n",
    "Example command to adjust your .bashrc:",
    `\necho 'export NODE_OPTIONS="--require=${PRELOAD_PATH}"' >> ~/.bashrc`,
    "\nAfter that, restart your terminal.",
    "\n[!]Consider that in some scenarios the Node you want proxied might not",
    "inherit environmental variables from your shell. In those cases",
    "you need to learn the supported way for vars provision and use it.",
  ].join('\n');
}

function getDirectorySetupText() {
  return [
    `Use 'add <dir>' command to whitelist locations allowed for the enforcer to run in.`,
  ].join('\n');
}

program
  .name("node-proxy-enforcer")
  .description("Global Node.js proxy enforcer with directory whitelist");

program
  .command("setup")
  .description("Configure proxies and guide NODE_OPTIONS setup")
  .action(async () => {
    await configureProxies();

    const currentDirectory = process.cwd();

    const initialDir = await ask(
      `\nEnter directory to allow (leave empty for current: ${currentDirectory})`
    );
    whitelistDir(initialDir ?? currentDirectory);

    console.log("\n" + getEnvSetupText());
  });

program
  .command("config-proxy")
  .description("Reconfigure HTTP/HTTPS proxy addresses")
  .action(async () => {
    await configureProxies();
  });

program
  .command("add <dir>")
  .description("Add whitelisted directory")
  .action((dir) => {
    whitelistDir(dir);
  });

program
  .command("remove <dir>")
  .description("Remove whitelisted directory")
  .action((dir) => {
    const config = loadConfig();
    const resolved = path.resolve(dir);

    config.whitelist = config.whitelist.filter(d => d !== resolved);
    saveConfig(config);
    console.log("Removed:", resolved);
  });

program
  .command("add-blacklist <dir>")
  .description("Add blacklisted directory")
  .action((dir) => {
    blacklistDir(dir);
  });

program
  .command("remove-blacklist <dir>")
  .description("Remove blacklisted directory")
  .action((dir) => {
    const config = loadConfig();
    const resolved = path.resolve(dir);

    config.whitelist = config.whitelist.filter(d => d !== resolved);
    saveConfig(config);
    console.log("Removed:", resolved);
  });

program
  .command("list")
  .description("List whitelisted directories")
  .action(() => {
    const { whitelist } = loadConfig();
    if (!whitelist.length) {
      console.log("No whitelisted directories.");
    } else {
      whitelist.forEach(d => console.log("-", d));
    }
  });

program
  .command("config-path")
  .description("Print config file location")
  .action(() => {
    console.log(CONFIG_PATH);
  });

program
  .command("enable")
  .description("Enable proxy enforcement globally (default state)")
  .action(() => {
    const config = loadConfig();
    config.disabled = false;
    saveConfig(config);
    console.log("Node proxy enforcer is now ENABLED.");
  });

program
  .command("disable")
  .description("Disable proxy enforcement globally")
  .action(() => {
    const config = loadConfig();
    config.disabled = true;
    saveConfig(config);
    console.log("Node proxy enforcer is now DISABLED.");
  });

program.addHelpText("before", [
  "\n1. Either run `setup` command or `config-proxy`.\n",
  "\n2. ",
  getEnvSetupText(),
  "\n",
  "\n3. " + getDirectorySetupText(),
  "\n",
].join(''))

program
  .command("help")
  .description("Show help")
  .action(() => {
    program.help();
  });

program.parse(process.argv);
