import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const apiDirectory = fileURLToPath(new URL("..", import.meta.url));

dotenv.config({ path: `${apiDirectory}.env` });
dotenv.config({ path: `${apiDirectory}.env.local`, override: true });

const { default: app } = await import("./app.js");

const port = Number(process.env.PORT ?? 3001);

app.listen(port, "0.0.0.0", () => {
  console.log(`odin-api listening on http://0.0.0.0:${port}`);
});
