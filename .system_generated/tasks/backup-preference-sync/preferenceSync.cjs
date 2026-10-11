"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/backend/backup/preferenceSync.ts
var preferenceSync_exports = {};
__export(preferenceSync_exports, {
  createBackupPreferenceSync: () => createBackupPreferenceSync
});
module.exports = __toCommonJS(preferenceSync_exports);
var import_promises = require("timers/promises");

// src/backend/backup/localStorageSnapshot.ts
var releaseKeys = /* @__PURE__ */ new Set([
  "ghost_release_tracking_v1",
  "ghost_release_tracking_recovery_v1",
  "ghost_tracked_releases",
  "ghost_releases_tracked",
  "ghost_releases_region",
  "ghost_releases_lang",
  "ghost_releases_view",
  "ghost_releases_preferences_v1",
  "ghost_alazterflix_card_preferences",
  "ghost_alazterflix_favorites"
]);
function validateLocalStorageSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Dados de backup inv\xE1lidos.");
  }
  const result = {};
  let size = 0;
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith("heroic_") && !releaseKeys.has(key)) continue;
    if (typeof value !== "string")
      throw new Error("Prefer\xEAncia de backup inv\xE1lida.");
    size += Buffer.byteLength(key) + Buffer.byteLength(value);
    if (size > 20 * 1024 * 1024)
      throw new Error("As prefer\xEAncias excedem o limite do backup (20 MB).");
    result[key] = value;
  }
  return result;
}

// src/backend/backup/preferenceSync.ts
function createBackupPreferenceSync(write, retryDelays = [100, 200, 400, 800, 1600]) {
  let pending = Promise.resolve();
  return (input) => {
    const snapshot = validateLocalStorageSnapshot(input);
    const operation = pending.catch(() => void 0).then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await write(snapshot);
          return;
        } catch (error) {
          const code = error?.code;
          if (attempt >= retryDelays.length || !["EPERM", "EBUSY", "EACCES"].includes(code || ""))
            throw error;
          await (0, import_promises.setTimeout)(retryDelays[attempt]);
        }
      }
    });
    pending = operation;
    return operation;
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createBackupPreferenceSync
});
