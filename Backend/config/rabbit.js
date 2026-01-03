// rabbit.js (replace everything with this)

import amqplib from "amqplib";

let connection = null;
let channel = null;
let isConnecting = false;

export async function connectRabbit() {
  if (isConnecting || connection) return;

  isConnecting = true;

  try {
    connection = await amqplib.connect("amqp://localhost", {
      timeout: 1000 // fast fail
    });

    connection.on("error", () => {
      console.log("🐇 RabbitMQ error → reconnecting...");
      reset();
    });

    connection.on("close", () => {
      console.log("🐇 RabbitMQ closed → reconnecting...");
      reset();
    });

    channel = await connection.createChannel();
    console.log("🐇 RabbitMQ connected.");

  } catch (err) {
    console.log("🐇 RabbitMQ FAILED:", err.message);
    reset();
  }

  isConnecting = false;
}

function reset() {
  connection = null;
  channel = null;

  // reconnect in background after 2 sec
  setTimeout(connectRabbit, 2000);
}

export function getChannel() {
  return channel; // simply returns null if disconnected (non-blocking)
}
