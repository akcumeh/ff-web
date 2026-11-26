import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.SUPABASE_DB_URL;
const key = process.env.SUPABASE_SEC_KEY;

if (!email || !url || !key?.startsWith("sb_secret_")) {
    console.error("Usage: npm run reset-mfa -- <email>   (needs SUPABASE_DB_URL and SUPABASE_SEC_KEY)");
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: admin } = await supabase.from("admins").select("user_id").eq("email", email).maybeSingle();
if (!admin) {
    console.error(`${email} is not in admins.`);
    process.exit(1);
}

const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: admin.user_id });
if (error) {
    console.error(`Could not list factors: ${error.message}`);
    process.exit(1);
}

for (const factor of data.factors) {
    const { error: delError } = await supabase.auth.admin.mfa.deleteFactor({ userId: admin.user_id, id: factor.id });
    if (delError) {
        console.error(`Could not remove factor ${factor.id}: ${delError.message}`);
        process.exit(1);
    }
}

console.log(`Removed ${data.factors.length} authenticator(s) for ${email}. They sign in with the password only until they set one up again.`);
