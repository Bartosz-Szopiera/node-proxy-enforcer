#!/usr/bin/env node

const { program } = require("commander");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { CONFIG_PATH, loadConfig, saveConfig } = require("../lib/config");
const { ask } = require("../lib/prompt");
const { isValidProxyUrl, isValidPacUrl } = require("../lib/validate");

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

async function askForValidPacUrl(label) {
  while (true) {
    const value = await ask(label);
    if (isValidPacUrl(value)) return value;

    console.log(
      "Invalid PAC URL format. Expected e.g. https://proxy.company.com/proxy.pac or file:///path/to/proxy.pac"
    );
  }
}

async function askYesNo(question) {
  while (true) {
    const answer = (await ask(question)).toLowerCase();
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    console.log("Please answer with y/yes or n/no.");
  }
}

async function configureProxies() {
  const usePacProxyAgent = await askYesNo(
    "Use PAC-based proxy agent? (y/N): "
  );
  const config = loadConfig();

  if (usePacProxyAgent) {
    const pacUrl = await askForValidPacUrl("Enter PAC URL: ");
    config.usePacProxyAgent = true;
    config.pacUrl = pacUrl;
    saveConfig(config);

    console.log("\nPAC proxy configuration saved:");
    console.log("  PAC mode:", "enabled");
    console.log("  PAC URL :", pacUrl);
    return;
  }

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

  config.usePacProxyAgent = false;
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
  .command("use-pac")
  .description("Enable or disable PAC-based proxy mode")
  .action(async () => {
    const config = loadConfig();
    const shouldEnable = await askYesNo("Enable PAC mode? (y/N): ");

    if (shouldEnable) {
      config.usePacProxyAgent = true;

      if (!config.pacUrl) {
        config.pacUrl = await askForValidPacUrl("Enter PAC URL: ");
      } else {
        console.log("PAC URL already set and will be used:", config.pacUrl);
      }
    } else {
      config.usePacProxyAgent = false;
    }

    saveConfig(config);
    console.log(
      "PAC mode is now",
      config.usePacProxyAgent ? "ENABLED." : "DISABLED."
    );
  });

program
  .command("set-pac-url <pacUrl>")
  .description("Set PAC URL used when PAC mode is enabled")
  .action((pacUrl) => {
    if (!isValidPacUrl(pacUrl)) {
      console.log(
        "Invalid PAC URL format. Expected e.g. https://proxy.company.com/proxy.pac or file:///path/to/proxy.pac"
      );
      process.exitCode = 1;
      return;
    }

    const config = loadConfig();
    config.pacUrl = pacUrl;
    saveConfig(config);

    console.log("PAC URL saved:", config.pacUrl);
    console.log(
      "PAC mode is currently",
      config.usePacProxyAgent ? "ENABLED." : "DISABLED."
    );
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
