import { migrate, database } from "../src/lib/store";
try {
  await migrate();
  console.log("Database schema and default rules are ready.");
} finally {
  if (process.env.DATABASE_URL) await database().end();
}
