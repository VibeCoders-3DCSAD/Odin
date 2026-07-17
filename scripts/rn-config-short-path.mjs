#!/usr/bin/env node
/**
 * Windows helper for Expo/RN autolinking under a subst drive.
 *
 * expo-modules-autolinking realpaths node_modules to the long C:\ path while
 * the app root stays on the subst drive (e.g. O:\). Gradle then fails with:
 *   "this and base files have different roots"
 *
 * This wraps the normal react-native-config command and rewrites the real
 * repo root back to the short drive so every path shares one root.
 *
 * Env:
 *   ODIN_ANDROID_SHORT_ROOT  e.g. O:\
 *   ODIN_ANDROID_REAL_ROOT   e.g. C:\...\Odin  (optional but preferred)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function stripTrailingSep(value) {
  return value.replace(/[\\/]+$/, "");
}

function ensureDirRoot(value) {
  const trimmed = value.trim();
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return `${trimmed[0]}:\\`;
  }
  return trimmed.endsWith("\\") || trimmed.endsWith("/")
    ? trimmed
    : `${trimmed}\\`;
}

function resolveRealRoot(shortRootDir) {
  if (process.env.ODIN_ANDROID_REAL_ROOT) {
    return stripTrailingSep(path.resolve(process.env.ODIN_ANDROID_REAL_ROOT));
  }
  // Must use O:\ (with slash). realpathSync("O:") resolves to the cwd on O:.
  return stripTrailingSep(fs.realpathSync(ensureDirRoot(shortRootDir)));
}

function rewritePaths(text, realRoot, shortDrive) {
  const realJsonEscaped = realRoot.replaceAll("\\", "\\\\");
  const shortJsonEscaped = shortDrive.replaceAll("\\", "\\\\");
  const pairs = [
    // Raw path forms
    [realRoot, shortDrive],
    [realRoot.replaceAll("\\", "/"), shortDrive.replaceAll("\\", "/")],
    // JSON-escaped backslashes: C:\\Users\\... -> O:
    [realJsonEscaped, shortJsonEscaped],
  ];

  let output = text;
  for (const [from, to] of pairs) {
    if (!from || from.toLowerCase() === to.toLowerCase()) continue;
    output = output.split(from).join(to);
    output = output.split(from.toLowerCase()).join(to);
  }
  return output;
}

const command = [
  "node",
  "--no-warnings",
  "--eval",
  "require('expo/bin/autolinking')",
  "expo-modules-autolinking",
  "react-native-config",
  "--platform",
  "android",
  "--json",
];

const result = spawnSync(command[0], command.slice(1), {
  encoding: "utf8",
  cwd: process.cwd(),
  env: process.env,
  maxBuffer: 64 * 1024 * 1024,
});

if (result.status !== 0) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

let stdout = result.stdout ?? "";
const shortRootEnv = process.env.ODIN_ANDROID_SHORT_ROOT;

if (shortRootEnv) {
  const shortDir = ensureDirRoot(shortRootEnv); // O:\
  const shortDrive = stripTrailingSep(shortDir); // O:
  const realRoot = resolveRealRoot(shortDir);

  if (realRoot.toLowerCase() !== shortDrive.toLowerCase()) {
    stdout = rewritePaths(stdout, realRoot, shortDrive);
  }
}

process.stdout.write(stdout);
if (result.stderr) process.stderr.write(result.stderr);
