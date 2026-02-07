#!/usr/bin/env node

/**
 * Garmin Workout Skill - Test Suite
 * Generates sample workouts and verifies output
 */

import { Decoder, Stream } from "@garmin/fitsdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the skill functions
import { generateWorkoutFile } from "./scripts/skill.js";

console.log("🧪 Garmin Workout Skill - Test Suite\n");
console.log("=".repeat(50));

// Test 1: Simple single-step workout
console.log("\n📋 Test 1: Simple 30-minute run");
const test1 = generateWorkoutFile({
  name: "Easy Run",
  sport: "running",
  subSport: "generic",
  steps: [{ name: "Run", duration: 1800, intensity: "active", targetType: "speed", targetMin: 8, targetMax: 10 }]
});
fs.writeFileSync("/tmp/test-easy-run.fit", test1);
console.log(`   ✅ Generated: /tmp/test-easy-run.fit (${test1.length} bytes)`);

// Test 2: Interval workout
console.log("\n📋 Test 2: HIIT Interval workout");
const test2 = generateWorkoutFile({
  name: "HIIT Session",
  sport: "running",
  subSport: "trail",
  steps: [
    { name: "Warm up", duration: 300, intensity: "warmup", targetType: "heartRate", targetMin: 110, targetMax: 130 },
    { name: "Sprint", duration: 60, intensity: "active", targetType: "heartRate", targetMin: 160, targetMax: 175 },
    { name: "Rest", duration: 60, intensity: "rest", targetType: "heartRate", targetMin: 100, targetMax: 120 },
    { name: "Sprint", duration: 60, intensity: "active", targetType: "heartRate", targetMin: 160, targetMax: 175 },
    { name: "Rest", duration: 60, intensity: "rest", targetType: "heartRate", targetMin: 100, targetMax: 120 },
    { name: "Cool down", duration: 300, intensity: "cooldown", targetType: "heartRate", targetMin: 110, targetMax: 130 }
  ]
});
fs.writeFileSync("/tmp/test-hiit.fit", test2);
console.log(`   ✅ Generated: /tmp/test-hiit.fit (${test2.length} bytes)`);

// Test 3: Cycling workout
console.log("\n📋 Test 3: Cycling workout");
const test3 = generateWorkoutFile({
  name: "Bike Session",
  sport: "cycling",
  subSport: "road",
  steps: [
    { name: "Warm up", duration: 600, intensity: "warmup", targetType: "heartRate", targetMin: 100, targetMax: 130 },
    { name: "Tempo", duration: 1200, intensity: "active", targetType: "power", targetMin: 150, targetMax: 200 },
    { name: "Cool down", duration: 300, intensity: "cooldown", targetType: "heartRate", targetMin: 90, targetMax: 110 }
  ]
});
fs.writeFileSync("/tmp/test-cycling.fit", test3);
console.log(`   ✅ Generated: /tmp/test-cycling.fit (${test3.length} bytes)`);

// Verify all files
console.log("\n🔍 Verification");
console.log("-".repeat(50));

const testFiles = [
  "/tmp/test-easy-run.fit",
  "/tmp/test-hiit.fit",
  "/tmp/test-cycling.fit"
];

let allValid = true;
for (const file of testFiles) {
  if (!fs.existsSync(file)) {
    console.log(`   ❌ Missing: ${file}`);
    allValid = false;
    continue;
  }

  const buffer = fs.readFileSync(file);
  const stream = Stream.fromBuffer(buffer);
  const isValid = Decoder.isFIT(stream);

  if (isValid) {
    console.log(`   ✅ ${path.basename(file)}: Valid FIT file (${buffer.length} bytes)`);
  } else {
    console.log(`   ❌ ${path.basename(file)}: Invalid FIT file`);
    allValid = false;
  }
}

console.log("\n" + "=".repeat(50));
console.log(allValid ? "✅ All tests passed!" : "❌ Some tests failed");

process.exit(allValid ? 0 : 1);