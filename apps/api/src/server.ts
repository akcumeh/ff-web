import app, { config } from "./index.ts";

app.listen(config.port, () => {
  console.log(`ff-api listening on http://localhost:${config.port}`);
});
