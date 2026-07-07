import * as dotenv from "dotenv";
dotenv.config();
console.log("Environment keys:");
console.log(Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("DATABASE") || k.includes("POSTGRES") || k.includes("KEY") || k.includes("URL")));
