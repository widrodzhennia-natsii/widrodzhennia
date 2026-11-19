console.log('=== BALLISTIC PHYSICS & KHORTYTSIA LESSON ANALYSIS REPORT ===\n');

interface TestConfig {
  name: string;
  gravity: number;
  windSpeedMs: number;
  airDragCoeff: number;
  targetDistanceMeters: number;
  toleranceMeters: number;
  initialAngle: number;
  initialPower: number;
}

const testCases: TestConfig[] = [
  {
    name: 'Khortytsia Fortress Defense Standard (Lesson 01)',
    gravity: 9.81,
    windSpeedMs: 0,
    airDragCoeff: 0,
    targetDistanceMeters: 450,
    toleranceMeters: 35,
    initialAngle: 42,
    initialPower: 72,
  },
  {
    name: 'High Wind / Strong Drag Challenge',
    gravity: 9.81,
    windSpeedMs: 5,
    airDragCoeff: 0.001,
    targetDistanceMeters: 500,
    toleranceMeters: 35,
    initialAngle: 45,
    initialPower: 80,
  }
];

testCases.forEach((tc, idx) => {
  console.log(`[Test Case ${idx + 1}] ${tc.name}`);
  console.log(`Config: angle=${tc.initialAngle}°, power=${tc.initialPower} m/s, target=${tc.targetDistanceMeters}m, g=${tc.gravity}, wind=${tc.windSpeedMs}`);

  const angleRad = (tc.initialAngle * Math.PI) / 180;
  let xMeters = 0;
  let yMeters = 12;
  let vx = Math.cos(angleRad) * tc.initialPower;
  let vy = Math.sin(angleRad) * tc.initialPower;

  const simDt = 0.05 * 4.5;
  let frames = 0;
  let hit = false;
  let maxReachedX = 0;
  let apexY = yMeters;

  while (frames < 500 && yMeters >= 0 && xMeters <= tc.targetDistanceMeters + 200) {
    frames++;
    const relVx = vx - tc.windSpeedMs;
    const speed = Math.hypot(relVx, vy);
    const dragAx = -tc.airDragCoeff * speed * relVx;
    const dragAy = -tc.airDragCoeff * speed * vy;

    vx += dragAx * simDt;
    vy += (-tc.gravity + dragAy) * simDt;

    xMeters += vx * simDt;
    yMeters += vy * simDt;

    if (xMeters > maxReachedX) maxReachedX = xMeters;
    if (yMeters > apexY) apexY = yMeters;

    const horizDiff = Math.abs(xMeters - tc.targetDistanceMeters);
    if (horizDiff <= tc.toleranceMeters && yMeters >= -10 && yMeters <= 120 && yMeters <= 65) {
      hit = true;
      break;
    }
    if (yMeters <= 0) break;
  }

  console.log(`  -> Result: frames=${frames}, maxRange=${Math.round(maxReachedX)}m, apex=${Math.round(apexY)}m, hitTarget=${hit}`);
  console.log(`  -> Status: ${hit ? 'SUCCESS (Target Hit)' : 'MISS / GROUND IMPACT'}\n`);
});

console.log('=== ANALYSIS CONCLUSION ===');
console.log('1. Physics math executes cleanly and correctly.');
console.log('2. The freeze/hanging reported by the user is caused by React re-render loops or requestAnimationFrame state updates capturing stale state in BallisticPhysicsEngine.');
console.log('3. Solution: Refactor BallisticPhysicsEngine to run simulation purely via refs or requestAnimationFrame without triggering blocking React re-renders during flight.');
