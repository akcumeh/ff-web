import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.SUPABASE_DB_URL;
const key = process.env.SUPABASE_SEC_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: npm run add-admin -- <email>");
  process.exit(1);
}
if (!url || !key?.startsWith("sb_secret_")) {
  console.error("SUPABASE_DB_URL and SUPABASE_SEC_KEY must be set (see apps/api/.env).");
  process.exit(1);
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      write(s.startsWith(question) ? s : "");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Password (12+ chars, upper, lower, digit): "));
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error("Password needs 12 or more characters with upper case, lower case and a digit.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: created, error: createError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
let userId = created?.user?.id;

if (createError) {
  if (createError.code !== "email_exists") {
    console.error(`Could not create the user: ${createError.message}`);
    process.exit(1);
  }
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (listError || !existing) {
    console.error("The user exists but could not be found.");
    process.exit(1);
  }
  userId = existing.id;
  const { error: pwError } = await supabase.auth.admin.updateUserById(userId, { password });
  if (pwError) {
    console.error(`Could not set the password: ${pwError.message}`);
    process.exit(1);
  }
}

const { error: adminError } = await supabase.from("admins").upsert({ user_id: userId, email }, { onConflict: "user_id" });
if (adminError) {
  console.error(`Could not add to admins: ${adminError.message}`);
  process.exit(1);
}

console.log(`${email} is an admin. Sign in at /admin/login.`);
