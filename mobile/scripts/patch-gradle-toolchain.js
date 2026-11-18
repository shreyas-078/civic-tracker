/**
 * Post-install script to patch the React Native Gradle plugin's
 * toolchain configuration so it uses the local JDK 21 instead of
 * trying to download JDK 17 from Foojay (which hangs).
 */
const fs = require("fs");
const path = require("path");

const pluginRoot = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native",
  "gradle-plugin"
);

// 1. Disable the Foojay toolchain resolver in settings.gradle.kts
const settingsFile = path.join(pluginRoot, "settings.gradle.kts");
if (fs.existsSync(settingsFile)) {
  let content = fs.readFileSync(settingsFile, "utf8");
  content = content.replace(
    /^plugins\s*\{[^}]*foojay[^}]*\}/m,
    "// foojay resolver disabled to use local JDK"
  );
  fs.writeFileSync(settingsFile, content);
  console.log("[patch] Disabled foojay resolver in settings.gradle.kts");
}

// 2. Change jvmToolchain(17) -> jvmToolchain(21) in all subproject build files
const subprojects = [
  "react-native-gradle-plugin",
  "settings-plugin",
  "shared",
  "shared-testutil",
];
for (const sub of subprojects) {
  const buildFile = path.join(pluginRoot, sub, "build.gradle.kts");
  if (fs.existsSync(buildFile)) {
    let content = fs.readFileSync(buildFile, "utf8");
    if (content.includes("jvmToolchain(17)")) {
      content = content.replace("jvmToolchain(17)", "jvmToolchain(21)");
      fs.writeFileSync(buildFile, content);
      console.log(`[patch] Updated jvmToolchain to 21 in ${sub}/build.gradle.kts`);
    }
  }
}

console.log("[patch] Gradle toolchain patching complete.");
