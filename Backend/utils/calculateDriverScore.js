export function calculateDriverScore(data) {
  let score = 100;

  // Uber-style event weights
  const wOverspeed = 4;
  const wHarshBrake = 3;
  const wHarshAccel = 2;
  const wFatigue = 6;

  // Normalize: Uber penalizes per 10 km to avoid punishing long trips too hard
  const distanceFactor = data.totalDistanceKm > 0 
    ? data.totalDistanceKm / 10 
    : 1;

  // Core penalties
  const overspeedPenalty = (data.overspeedCount * wOverspeed) / distanceFactor;
  const harshBrakePenalty = (data.harshBrakingCount * wHarshBrake) / distanceFactor;
  const harshAccelPenalty = (data.harshAccelerationCount * wHarshAccel) / distanceFactor;
  const fatiguePenalty = data.fatigueAlerts * wFatigue;  // fatigue is not normalized

  score -= overspeedPenalty;
  score -= harshBrakePenalty;
  score -= harshAccelPenalty;
  score -= fatiguePenalty;

  // Clamp values
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}
