import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const teamDataModule = "virtual:team-data";
const resolvedTeamDataModule = `\0${teamDataModule}`;

function excelDataPlugin() {
  return {
    name: "excel-team-data",
    resolveId(id: string) {
      return id === teamDataModule ? resolvedTeamDataModule : undefined;
    },
    load(id: string) {
      if (id !== resolvedTeamDataModule) return undefined;
      const outputPath = path.join(os.tmpdir(), `sv-twello-team-${process.pid}.json`);
      try {
        execFileSync(process.execPath, ["scripts/extract-excel.mjs", "data/2026-2027_zondag2.xlsx"], {
          env: { ...process.env, TEAM_OUTPUT_PATH: outputPath },
          stdio: "ignore",
        });
        return `export default ${fs.readFileSync(outputPath, "utf8")};`;
      } finally {
        fs.rmSync(outputPath, { force: true });
      }
    },
  };
}

export default defineConfig({
  root: "static",
  base: "./",
  publicDir: "../public",
  plugins: [excelDataPlugin(), react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
