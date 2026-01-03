import { createClient } from "redis";

let redis = null;

try {
  const client = createClient({
    url: "redis://localhost:6379",
    socket: {
      reconnectStrategy: false, // Don't retry endlessly
    }
  });

  client.on("error", (err) => {
    console.log("⚠️ Redis not running, continuing without cache.");
  });

  await client.connect();

  console.log("✅ Redis Connected");
  redis = client;

} catch (err) {
  console.log("⚠️ Redis unavailable → Running without Redis Cache.");
  redis = null; // IMPORTANT → Makes Redis optional
}

export default redis;
