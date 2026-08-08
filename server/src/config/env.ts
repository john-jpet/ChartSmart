import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  lastfm: {
    apiKey: required("LAST_FM_API_KEY"),
    sharedSecret: process.env.LAST_FM_SHARED_SECRET ?? "",
    username: process.env.LAST_FM_USERNAME ?? "",
  },
};
