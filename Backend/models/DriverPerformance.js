import mongoose from "mongoose";

const DriverPerformanceSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      unique: true
    },

    /* ================================
          DRIVING BEHAVIOUR METRICS
    ==================================*/
    overspeedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    harshBrakingCount: {
      type: Number,
      default: 0,
      min: 0
    },
    harshAccelerationCount: {
      type: Number,
      default: 0,
      min: 0
    },
    idleTimeMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    routeDeviationCount: {
      type: Number,
      default: 0,
      min: 0
    },

    /* ================================
                FATIGUE
    ==================================*/
    fatigueAlerts: {
      type: Number,
      default: 0,
      min: 0
    },

    /* ================================
                TRIP METRICS
    ==================================*/
    totalTrips: {
      type: Number,
      default: 0,
      min: 0
    },
    totalDistanceKm: {
      type: Number,
      default: 0,
      min: 0
    },
    totalDrivingMinutes: {
      type: Number,
      default: 0,
      min: 0
    },

    /* ================================
              FUEL METRICS
    ==================================*/
    fuelUsedLiters: {
      type: Number,
      default: 0,
      min: 0
    },
    fuelEfficiencyKmPerLiter: {
      type: Number,
      default: 0,
      min: 0
    },
tripScores: {
  type: [Number], // stores score of each completed trip
  default: []
},

averageTripScore: {
  type: Number,
  default: 100
},

    /* ================================
                FINAL SCORE
    ==================================*/
    performanceScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },

    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.model("DriverPerformance", DriverPerformanceSchema);
