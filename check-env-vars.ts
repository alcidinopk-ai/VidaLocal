console.log("=== ENV VARS ===");
for (const key of Object.keys(process.env)) {
  if (key.includes("SUPABASE") || key.includes("DATABASE") || key.includes("POSTGRES") || key.includes("DB_")) {
    console.log(`${key}: ${key.includes("KEY") || key.includes("PASSWORD") || key.includes("URL") ? "REDACTED" : process.env[key]}`);
  }
}
