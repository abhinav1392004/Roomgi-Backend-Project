// utils/redis.js
const { createClient } = require("redis");

const client = createClient({
  url: "redis://default:GAwEUzyB65JRVGdIaXCwomLPlGudHCwu@redis-13152.c270.us-east-1-3.ec2.cloud.redislabs.com:13152"
});

client.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  await client.connect();
  console.log("✅ Connected to Redis");
})();

module.exports = client;
