// Auto-loaded YAML configuration.
//
// At app boot, App.jsx calls `loadConfig()` once; every other module
// imports `getConfig()` (synchronous, throws if not yet loaded) or
// the convenience getters below.

import { Asset } from "expo-asset";
// Use the legacy API path — `readAsStringAsync` was moved here in SDK 54
// when the new `File` / `Directory` class API became the default export.
import * as FileSystem from "expo-file-system/legacy";
import yaml from "js-yaml";

// Require the bundled YAML — works because metro.config.js adds
// "yaml" to assetExts.
const CONFIG_ASSET = require("../../config.yaml");

let _config = null;
let _loadingPromise = null;

const DEFAULTS = {
  backend: {
    host: "192.168.1.10",
    port: 8080,
    scheme: "http",
    wsScheme: "ws",
    apiPath: "/api",
    timeoutMs: 10000,
  },
  app: {
    allowedRoles: ["STUDENT", "TEACHER"],
  },
  face: {
    captureIntervalMs: 450,
    jpegQuality: 0.6,
    frameSize: 320,
  },
};

const deepMerge = (base, override) => {
  if (!override) return base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const bv = base?.[k];
    const ov = override[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && ov && typeof ov === "object" && !Array.isArray(ov)) {
      out[k] = deepMerge(bv, ov);
    } else if (ov !== undefined && ov !== null) {
      out[k] = ov;
    }
  }
  return out;
};

export const loadConfig = async () => {
  if (_config) return _config;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    try {
      const asset = Asset.fromModule(CONFIG_ASSET);
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      const raw = await FileSystem.readAsStringAsync(uri);
      const parsed = yaml.load(raw) || {};
      _config = deepMerge(DEFAULTS, parsed);
      return _config;
    } catch (err) {
      console.warn("[config] Failed to load config.yaml, falling back to defaults:", err);
      _config = DEFAULTS;
      return _config;
    }
  })();

  return _loadingPromise;
};

export const getConfig = () => {
  if (!_config) {
    throw new Error("Config not loaded yet. Call loadConfig() during app boot.");
  }
  return _config;
};

export const backendBaseUrl = () => {
  const c = getConfig().backend;
  return `${c.scheme}://${c.host}:${c.port}${c.apiPath}`;
};

export const backendWsBase = () => {
  const c = getConfig().backend;
  return `${c.wsScheme}://${c.host}:${c.port}`;
};

export const backendHttpBase = () => {
  const c = getConfig().backend;
  return `${c.scheme}://${c.host}:${c.port}`;
};
