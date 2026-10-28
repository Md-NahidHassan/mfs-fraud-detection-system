import { withState, database } from "../src/lib/store";
import { seedState } from "../src/lib/scenarios";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL before seeding PostgreSQL. Local demo data is created automatically.",
  );
try {
  await withState(true, (s) => {
    if (s.transactions.length)
      throw new Error("Seed refused: database already has transactions.");
    Object.assign(s, seedState());
  });
  console.log("Inserted 48 synthetic demo transactions.");
} finally {
  await database().end();
}
