import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function setPassword() {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!admin) {
    console.error("Admin user not found. Run seed first.");
    process.exit(1);
  }

  const hashed = await bcrypt.hash("admin", 12);

  await db
    .update(users)
    .set({ password: hashed })
    .where(eq(users.id, admin.id));

  console.log(`Password set for admin user: ${admin.nama}`);
  process.exit(0);
}

setPassword().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
