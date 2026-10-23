const { withAppDelegate, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// SQLCipher data must not be restored without this installation's SecureStore keys.
module.exports = function withOfflineDataProtection(config) {
  config = withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application[0].$;
    application["android:allowBackup"] = "false";
    application["android:fullBackupContent"] = "false";
    application["android:dataExtractionRules"] = "@xml/odin_data_extraction_rules";
    return result;
  });
  config = withDangerousMod(config, ["android", async (result) => {
    const directory = path.join(result.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(directory, { recursive: true });
    const excludes = ["root", "file", "database", "sharedpref", "external"].map((domain) =>
      `    <exclude domain="${domain}" path="." />`).join("\n");
    await fs.writeFile(path.join(directory, "odin_data_extraction_rules.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${excludes}\n  </cloud-backup>\n  <device-transfer>\n${excludes}\n  </device-transfer>\n</data-extraction-rules>\n`);
    return result;
  }]);
  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== "swift") {
      throw new Error("Offline data backup exclusion requires the Expo Swift AppDelegate.");
    }
    const marker = "// Odin: exclude local financial data from device backups";
    if (!result.modResults.contents.includes(marker)) {
      const anchor = "return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
      if (!result.modResults.contents.includes(anchor)) throw new Error("Could not configure offline data backup exclusion.");
      result.modResults.contents = result.modResults.contents.replace(anchor, `${marker}
    if var documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      var backupValues = URLResourceValues()
      backupValues.isExcludedFromBackup = true
      try? documents.setResourceValues(backupValues)
    }
    ${anchor}`);
    }
    return result;
  });
};
