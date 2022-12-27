import { Parcel } from "@parcel/core";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import _manifest from "../manifest.json";
import { Theme } from "replugged/dist/types/addon";
import { join } from "path";

const manifest: Theme = _manifest;

const main = manifest.main || "src/main.css";
const splash = manifest.splash || (existsSync("src/splash.css") ? "src/splash.css" : undefined);

const mainDist = "main.css";
const splashDist = "splash.css";

const mainBundler = new Parcel({
  entries: main,
  defaultConfig: "@parcel/config-default",
  targets: {
    main: {
      distDir: "dist",
      distEntry: mainDist,
    },
  },
});

const splashBundler = new Parcel({
  entries: splash,
  defaultConfig: "@parcel/config-default",
  targets: {
    main: {
      distDir: "dist",
      distEntry: splashDist,
    },
  },
});

const REPLUGGED_FOLDER_NAME = "replugged";
export const CONFIG_PATH = (() => {
  switch (process.platform) {
    case "win32":
      return join(process.env.APPDATA || "", REPLUGGED_FOLDER_NAME);
    case "darwin":
      return join(process.env.HOME || "", "Library", "Application Support", REPLUGGED_FOLDER_NAME);
    default:
      if (process.env.XDG_CONFIG_HOME) {
        return join(process.env.XDG_CONFIG_HOME, REPLUGGED_FOLDER_NAME);
      }
      return join(process.env.HOME || "", ".config", REPLUGGED_FOLDER_NAME);
  }
})();

async function install() {
  if (!process.argv.includes("--no-install")) {
    const dest = join(CONFIG_PATH, "themes", manifest.id);
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true });
    }
    cpSync("dist", dest, { recursive: true });
    console.log("Installed updated version");
  }
}

async function build(bundler: Parcel) {
  try {
    const { bundleGraph, buildTime } = await bundler.run();
    let bundles = bundleGraph.getBundles();
    console.log(`✨ Built ${bundles.length} bundles in ${buildTime}ms!`);
    await install();
  } catch (err) {
    console.log(err.diagnostics);
  }
}

async function watch(bundler: Parcel) {
  const subscription = await bundler.watch(async (err, event) => {
    if (err) {
      // fatal error
      throw err;
    }
    if (!event) return;

    if (event.type === "buildSuccess") {
      let bundles = event.bundleGraph.getBundles();
      console.log(`Built ${bundles[0].displayName}`);
      await install();
    } else if (event.type === "buildFailure") {
      console.log(event.diagnostics);
    }
  });
}

const shouldWatch = process.argv.includes("--watch");

const fn = shouldWatch ? watch : build;
[mainBundler, splashBundler].filter(Boolean).forEach((bundler) => fn(bundler!));

manifest.main = mainDist;
manifest.splash = splashDist;

if (!existsSync("dist")) {
  mkdirSync("dist");
}

writeFileSync("dist/manifest.json", JSON.stringify(manifest));
