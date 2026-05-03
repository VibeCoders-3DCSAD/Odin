import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({
    service: "odin-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_request, response) => {
  response.status(200).json({
    message: "Odin API is running.",
  });
});

app.listen(port, () => {
  console.log(`odin-api listening on http://localhost:${port}`);
});
