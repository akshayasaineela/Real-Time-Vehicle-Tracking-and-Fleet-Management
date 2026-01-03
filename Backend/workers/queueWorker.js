// workers/queueWorker.js
import amqp from "amqplib";
import DriverPerformance from "../models/DriverPerformance.js";
import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";

async function startWorker() {
  try {
    const connection = await amqp.connect(process.env.RABBIT_URL || "amqp://guest:guest@localhost");
    const ch = await connection.createChannel();

    await ch.assertQueue("vehicle_events");
    await ch.assertQueue("driver_events");
    await ch.assertQueue("trip_events");
    await ch.assertQueue("performance_events");
    await ch.assertQueue("alerts");

    console.log("🐇 Queue Worker Running...");

    // ============================================================
    // SAFE HELPER → Skip if document missing (prevents 10s timeout)
    // ============================================================
    async function safeUpdateTrip(id, update) {
      const trip = await Trip.findById(id).lean();
      if (!trip) {
        console.log("⚠ Skipping missing Trip:", id);
        return;
      }
      return Trip.updateOne({ _id: id }, update);
    }

    async function safeUpdatePerf(driverId, update) {
      return DriverPerformance.updateOne({ driver: driverId }, update, { upsert: true });
    }

    // ============================================================
    // 🚗 VEHICLE EVENTS
    // ============================================================
    ch.consume("vehicle_events", async (msg) => {
      const event = JSON.parse(msg.content.toString());

      try {
        switch (event.type) {
          case "driver_assigned":
            await Vehicle.updateOne({ _id: event.vehicleId }, { driver: event.driverId });
            await Driver.updateOne({ _id: event.driverId }, { assignedVehicle: event.vehicleId });
            break;

          case "location_update":
            await Vehicle.updateOne(
              { _id: event.vehicleId },
              {
                lat: event.lat,
                lng: event.lng,
                speed: event.speed,
                status: event.status,
                lastUpdated: new Date()
              }
            );
            break;

          default:
            console.log("Vehicle event:", event);
        }
      } catch (err) {
        console.log("Vehicle event error:", err.message);
      }

      ch.ack(msg);
    });

    // ============================================================
    // 🧍 DRIVER EVENTS
    // ============================================================
    ch.consume("driver_events", (msg) => {
      const event = JSON.parse(msg.content.toString());
      console.log("Driver event:", event);
      ch.ack(msg);
    });

    // ============================================================
    // 🚌 TRIP EVENTS  (NOW 100% SAFE)
    // ============================================================
    ch.consume("trip_events", async (msg) => {
      const event = JSON.parse(msg.content.toString());

      try {
        switch (event.type) {
          case "trip_created":
            console.log("🗺 Trip created:", event.tripId);
            break;

          case "trip_started":
            await safeUpdateTrip(event.tripId, { status: "ongoing" });
            break;

          case "trip_completed":
            await safeUpdateTrip(event.tripId, {
              status: "completed",
              endTime: new Date()
            });
            break;

          case "coordinates_updated":
            await safeUpdateTrip(event.tripId, {
              originCoords: event.originCoords,
              destinationCoords: event.destinationCoords
            });
            break;

          case "route_point_added":
            await safeUpdateTrip(event.tripId, {
              $push: { route: { lat: event.lat, lng: event.lng, time: new Date() } }
            });
            break;

          default:
            console.log("Unknown trip event:", event);
        }
      } catch (err) {
        console.log("Trip event error:", err.message);
      }

      ch.ack(msg);
    });

    // ============================================================
    // 🚨 ALERT EVENTS (fast + safe)
    // ============================================================
    ch.consume("alerts", async (msg) => {
      const alert = JSON.parse(msg.content.toString());
      console.log("🚨 ALERT:", alert);

      try {
        switch (alert.type) {
          case "overspeed":
            await safeUpdatePerf(alert.driverId, { $inc: { overspeedCount: 1 } });
            break;

          case "harsh_brake":
            await safeUpdatePerf(alert.driverId, { $inc: { harshBrakingCount: 1 } });
            break;

          case "harsh_accel":
            await safeUpdatePerf(alert.driverId, { $inc: { harshAccelerationCount: 1 } });
            break;

          case "fatigue":
            await safeUpdatePerf(alert.driverId, { $inc: { fatigueAlerts: 1 } });
            break;
        }
      } catch (err) {
        console.log("Alert event error:", err.message);
      }

      ch.ack(msg);
    });

  } catch (err) {
    console.log("❌ Worker crashed → Restarting in 5s...", err.message);
    setTimeout(startWorker, 5000);
  }
}

startWorker();
