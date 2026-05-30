import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const files = [".htaccess"];
const publicDir = join(process.cwd(), "public");
const distDir = join(process.cwd(), "dist");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

for (const file of files) {
  const source = join(publicDir, file);
  const target = join(distDir, file);

  if (existsSync(source)) {
    copyFileSync(source, target);
  }
}
