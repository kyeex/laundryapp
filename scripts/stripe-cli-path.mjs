import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function resolveStripeCliPath() {
  const configuredPath = process.env.STRIPE_CLI_PATH;

  if (configuredPath) {
    if (fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    throw new Error(`STRIPE_CLI_PATH is set but does not exist: ${configuredPath}`);
  }

  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
  const candidates = [
    path.join(localAppData, "Microsoft", "WinGet", "Links", "stripe.exe"),
    path.join(
      localAppData,
      "Microsoft",
      "WinGet",
      "Packages",
      "Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "stripe.exe",
    ),
    path.join("C:", "Program Files", "Stripe", "stripe.exe"),
    path.join("C:", "ProgramData", "chocolatey", "bin", "stripe.exe"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));

  if (match) {
    return match;
  }

  throw new Error(
    "Stripe CLI was not found. Install it or set STRIPE_CLI_PATH to stripe.exe before running Stripe QA scripts.",
  );
}
