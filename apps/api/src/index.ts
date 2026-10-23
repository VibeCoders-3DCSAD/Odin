import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const apiDirectory = fileURLToPath(new URL("..", import.meta.url));

dotenv.config({ path: `${apiDirectory}.env` });
dotenv.config({ path: `${apiDirectory}.env.local`, override: true });

const { default: app } = await import("./app.js");

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  console.log(`odin-api listening on http://${host}:${port}`);
});
