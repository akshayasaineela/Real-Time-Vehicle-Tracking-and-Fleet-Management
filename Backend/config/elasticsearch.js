import { Client } from "@elastic/elasticsearch";

const elastic = new Client({
  node: "http://localhost:9200",
  // If security enabled:
  // auth: { username: "elastic", password: "your-password" }
});

export default elastic;
