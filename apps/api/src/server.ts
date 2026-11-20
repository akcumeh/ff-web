import app from "./index.ts";

// Local only. On Vercel the default export in index.ts is used instead.
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`ff-api listening on http://localhost:${port}`);
});
