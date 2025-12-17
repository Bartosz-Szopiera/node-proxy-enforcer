#!/usr/bin/env node

const { program } = require("commander");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { CONFIG_PATH, loadConfig, saveConfig } = require("../lib/config");
const { ask } = require("../lib/prompt");

const PRELOAD_PATH = path.resolve(__dirname, "../lib/preload.js");

async function configureProxies() {
  const httpsProxy = await ask("Enter HTTPS proxy address: ");

  if (!httpsProxy) {
    console.error("HTTPS proxy is required.");
    process.exit(1);
  }

  const httpProxyInput = await ask(
    "Enter HTTP proxy address (leave empty to use HTTPS proxy): "
  );

  const httpProxy = httpProxyInput || httpsProxy;

  const config = loadConfig();
  config.httpsProxy = httpsProxy;
  config.httpProxy = httpProxy;

  saveConfig(config);

  console.log("\nProxy configuration saved:");
  console.log("  HTTPS:", httpsProxy);
  console.log("  HTTP :", httpProxy);
}

program
  .name("node-proxy-enforcer")
  .description("Global Node.js proxy enforcer with directory whitelist");

program
  .command("setup")
  .description("Configure proxies and guide NODE_OPTIONS setup")
  .action(async () => {
    await configureProxies();

    const line = `export NODE_OPTIONS="--require=${PRELOAD_PATH}"`;

    console.log("\nAdd the following line to your shell config:\n");
    console.log(line);
    console.log("\nTypical files:");
    console.log("  ~/.bashrc");
    console.log("  ~/.zshrc");
    console.log("  ~/.profile\n");
    console.log("Example command to adjust your .bashrc:\n");
    console.log(`echo 'export NODE_OPTIONS="--require=${PRELOAD_PATH}"' >> ~/.bashrc\n`);
    console.log("After that, restart your terminal.");
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
    const config = loadConfig();
    const resolved = path.resolve(dir);

    if (!config.whitelist.includes(resolved)) {
      config.whitelist.push(resolved);
      saveConfig(config);
      console.log("Added:", resolved);
    } else {
      console.log("Already whitelisted.");
    }
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
  .command("help")
  .description("Show help")
  .action(() => {
    program.help();
  });

program.parse(process.argv);
