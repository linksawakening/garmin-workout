#!/usr/bin/env node

/**
 * Verify Garmin FIT workout file
 */

import { Decoder, Stream } from "@garmin/fitsdk";
import fs from "fs";

const filePath = process.argv[2] || "/tmp/test-workout.fit";

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const stream = Stream.fromBuffer(buffer);

console.log("📁 FIT File Verification");
console.log("========================");
console.log(`File: ${filePath}`);
console.log(`Size: ${buffer.length} bytes`);
console.log(`isFIT: ${Decoder.isFIT(stream)}`);

const decoder = new Decoder(stream);
console.log(`checkIntegrity: ${decoder.checkIntegrity()}`);

const { messages, errors } = decoder.read();

if (errors.length > 0) {
  console.log("\n⚠️  Errors:");
  errors.forEach(e => console.log(`  - ${e}`));
}

console.log("\n📊 Messages by type:");
for (const [type, msgs] of Object.entries(messages)) {
  console.log(`  ${type}: ${msgs.length} message(s)`);
  if (msgs.length > 0 && typeof msgs[0] === 'object') {
    msgs.slice(0, 2).forEach((msg, i) => {
      console.log(`    [${i}] ${JSON.stringify(msg).substring(0, 200)}...`);
    });
  }
}

console.log("\n✅ FIT file is valid!");