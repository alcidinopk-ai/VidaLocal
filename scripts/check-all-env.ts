import * as dotenv from "dotenv";
dotenv.config();
console.log("All environment keys:");
console.log(Object.keys(process.env));
