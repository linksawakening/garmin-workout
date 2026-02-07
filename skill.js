#!/usr/bin/env node

/**
 * Garmin Workout Skill
 * Generates Garmin-compatible .FIT workout files or JSON for Garmin Connect import
 * Compatible with fulippo/share-your-garmin-workout Chrome extension
 */

import { Encoder, Profile, Utils } from "@garmin/fitsdk";
import fs from "fs";

// Intensity mapping
const INTENSITY_MAP = {
  warmup: 0,
  active: 1,
  cooldown: 2,
  rest: 3
};

// Intensity mapping for JSON output (fulippo extension format)
const INTENSITY_JSON_MAP = {
  warmup: { intensityId: 0, intensityKey: "warmup" },
  active: { intensityId: 1, intensityKey: "active" },
  cooldown: { intensityId: 2, intensityKey: "cooldown" },
  rest: { intensityId: 3, intensityKey: "rest" }
};

// Target type mapping (FIT protocol values)
const TARGET_TYPE_MAP = {
  heartRate: 1,    // Heart Rate
  speed: 3,        // Speed
  power: 5,        // Power
  cadence: 7,     // Cadence
  pace: 9          // Pace
};

// Target type mapping for JSON output (fulippo extension format)
const TARGET_TYPE_JSON_MAP = {
  heartRate: { stepTargetId: 2, stepTargetKey: "heartRate" },
  speed: { stepTargetId: 3, stepTargetKey: "speed" },
  power: { stepTargetId: 5, stepTargetKey: "power" },
  cadence: { stepTargetId: 7, stepTargetKey: "cadence" },
  pace: { stepTargetId: 9, stepTargetKey: "pace" },
  noTarget: { stepTargetId: 0, stepTargetKey: "noTarget" }
};

// Sport type mapping for JSON output
const SPORT_TYPE_JSON_MAP = {
  running: { sportTypeId: 1, sportTypeKey: "running" },
  cycling: { sportTypeId: 2, sportTypeKey: "cycling" },
  swimming: { sportTypeId: 4, sportTypeKey: "swimming" },
  walking: { sportTypeId: 8, sportTypeKey: "walking" },
  fitness: { sportTypeId: 12, sportTypeKey: "fitness" },
  strength: { sportTypeId: 13, sportTypeKey: "strength" },
  cardio: { sportTypeId: 15, sportTypeKey: "cardio" },
  hiking: { sportTypeId: 18, sportTypeKey: "hiking" },
  rowing: { sportTypeId: 19, sportTypeKey: "rowing" },
  elliptical: { sportTypeId: 21, sportTypeKey: "elliptical" },
  stairClimbing: { sportTypeId: 22, sportTypeKey: "stairClimbing" }
};

// Step type mapping for JSON output
const STEP_TYPE_JSON_MAP = {
  time: { stepTypeId: 3, stepTypeKey: "time" },
  distance: { stepTypeId: 1, stepTypeKey: "distance" }
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    output: null,
    steps: null,
    sport: "running",
    subSport: "generic"
    // format is now auto-detected from output path, no explicit --format
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === "--steps" && args[i + 1]) {
      try {
        options.steps = JSON.parse(args[++i]);
      } catch (e) {
        throw new Error("Invalid JSON in --steps argument");
      }
    } else if (arg === "--sport" && args[i + 1]) {
      options.sport = validateSport(args[++i]);
    } else if (arg === "--subSport" && args[i + 1]) {
      options.subSport = args[++i];
    }
    // Removed --format option - format is determined by output path
  }

  // Validate required options
  if (!options.name) throw new Error("--name is required");
  if (!options.steps) throw new Error("--steps is required");
  if (!Array.isArray(options.steps) || options.steps.length === 0) {
    throw new Error("--steps must be a non-empty JSON array");
  }

  // output is optional - when not specified, generate both formats
  return options;
}

/**
 * Determine output format from path
 * @param {string} outputPath - Path or null
 * @param {string} workoutName - Workout name for default file naming
 * @returns {Object} - Object with fitPath, jsonPath, formatMode ('fit', 'json', 'both')
 */
function determineOutput(outputPath, workoutName) {
  // Sanitize workout name for filename
  const safeName = workoutName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();

  if (!outputPath) {
    // No output specified - generate both in current directory
    return {
      fitPath: `${safeName}.fit`,
      jsonPath: `${safeName}.json`,
      formatMode: "both"
    };
  }

  const normalizedPath = outputPath.endsWith("/") ? outputPath : outputPath;

  try {
    const stats = fs.statSync(normalizedPath);
    if (stats.isDirectory()) {
      // Output is a directory - generate both files in that directory
      return {
        fitPath: `${normalizedPath}${safeName}.fit`,
        jsonPath: `${normalizedPath}${safeName}.json`,
        formatMode: "both"
      };
    }
  } catch (e) {
    // Path doesn't exist yet - check extension
  }

  // Check file extension
  const lowerPath = normalizedPath.toLowerCase();
  if (lowerPath.endsWith(".fit")) {
    return {
      fitPath: normalizedPath,
      jsonPath: null,
      formatMode: "fit"
    };
  } else if (lowerPath.endsWith(".json")) {
    return {
      fitPath: null,
      jsonPath: normalizedPath,
      formatMode: "json"
    };
  }

  // Unknown extension - default to both
  return {
    fitPath: `${normalizedPath}.fit`,
    jsonPath: `${normalizedPath}.json`,
    formatMode: "both"
  };
}

/**
 * Convert duration to FIT duration type and value
 * FIT uses duration type (time=0, distance=1, heart rate=2, etc.)
 * and a duration value
 */
function formatDuration(duration) {
  return {
    duration: duration,
    durationTime: duration
  };
}

// Validate sport type
const VALID_SPORTS = Object.keys(SPORT_TYPE_JSON_MAP);
function validateSport(sport) {
  const lower = sport.toLowerCase();
  if (!VALID_SPORTS.includes(lower)) {
    throw new Error(`Invalid sport: "${sport}". Valid sports: ${VALID_SPORTS.join(", ")}`);
  }
  return lower;
}

/**
 * Build workout messages
 */
function buildWorkoutMessages(options) {
  const now = new Date();
  const startTime = Utils.convertDateToDateTime(now);
  const messages = [];

  // FILE_ID message (required for all FIT files)
  messages.push({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "workout",
    manufacturer: "development",
    product: 1,
    timeCreated: startTime,
    serialNumber: 12345
  });

  // WORKOUT message
  messages.push({
    mesgNum: Profile.MesgNum.WORKOUT,
    sport: options.sport,
    subSport: options.subSport,
    workoutName: options.name,
    workoutSteps: options.steps.length,
    numValidSteps: options.steps.length
  });

  // WORKOUT_STEP messages
  options.steps.forEach((step, index) => {
    const intensity = INTENSITY_MAP[step.intensity?.toLowerCase()] ?? 1;
    const targetType = TARGET_TYPE_MAP[step.targetType?.toLowerCase()] ?? 0;

    const stepMessage = {
      mesgNum: Profile.MesgNum.WORKOUT_STEP,
      messageIndex: index,
      stepName: step.name,
      durationType: "time",  // Using time-based duration
      durationValue: step.duration,
      intensity: intensity
    };

    // Add target information if provided
    if (step.targetType) {
      stepMessage.targetType = targetType;
      stepMessage.targetValueLow = step.targetMin ?? 0;
      stepMessage.targetValueHigh = step.targetMax ?? 0;
    }

    messages.push(stepMessage);
  });

  return messages;
}

/**
 * Generate JSON output compatible with fulippo's Chrome extension
 * Schema: https://github.com/fulippo/share-your-garmin-workout
 */
function generateJsonOutput(options) {
  const sportType = SPORT_TYPE_JSON_MAP[options.sport.toLowerCase()] || SPORT_TYPE_JSON_MAP.running;

  const workoutSegments = [{
    segmentOrder: 1,
    workoutSteps: options.steps.map((step, index) => {
      const intensity = INTENSITY_JSON_MAP[step.intensity?.toLowerCase()] || INTENSITY_JSON_MAP.active;
      const targetType = step.targetType ? TARGET_TYPE_JSON_MAP[step.targetType.toLowerCase()] : TARGET_TYPE_JSON_MAP.noTarget;
      const stepType = step.durationType?.toLowerCase() === "distance" ? STEP_TYPE_JSON_MAP.distance : STEP_TYPE_JSON_MAP.time;

      const stepObj = {
        stepId: null,
        stepName: step.name,
        stepType: stepType,
        duration: {
          type: "time",
          value: step.duration
        },
        intensity: intensity
      };

      // Add targetType if provided
      if (step.targetType) {
        stepObj.targetType = TARGET_TYPE_JSON_MAP[step.targetType.toLowerCase()] || TARGET_TYPE_JSON_MAP.noTarget;
      }

      return stepObj;
    })
  }];

  return {
    workoutName: options.name,
    sportType: sportType,
    workoutSegments: workoutSegments
  };
}

/**
 * Validate JSON output against Garmin's expected schema
 * @param {Object} jsonOutput - The JSON object to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateJsonOutput(jsonOutput) {
  const errors = [];

  // Check required top-level fields
  if (!jsonOutput.workoutName || typeof jsonOutput.workoutName !== "string") {
    errors.push("Missing or invalid required field: workoutName (string)");
  }

  if (!jsonOutput.sportType || typeof jsonOutput.sportType !== "object") {
    errors.push("Missing or invalid required field: sportType (object)");
  } else {
    if (typeof jsonOutput.sportType.sportTypeId !== "number") {
      errors.push("Missing required field: sportType.sportTypeId (number)");
    }
    if (typeof jsonOutput.sportType.sportTypeKey !== "string") {
      errors.push("Missing required field: sportType.sportTypeKey (string)");
    }
  }

  if (!jsonOutput.workoutSegments || !Array.isArray(jsonOutput.workoutSegments)) {
    errors.push("Missing or invalid required field: workoutSegments (array)");
  } else {
    if (jsonOutput.workoutSegments.length === 0) {
      errors.push("workoutSegments must not be empty");
    }

    jsonOutput.workoutSegments.forEach((segment, segIndex) => {
      if (typeof segment.segmentOrder !== "number") {
        errors.push(`Segment ${segIndex}: Missing required field: segmentOrder (number)`);
      }

      if (!segment.workoutSteps || !Array.isArray(segment.workoutSteps)) {
        errors.push(`Segment ${segIndex}: Missing or invalid field: workoutSteps (array)`);
      } else {
        if (segment.workoutSteps.length === 0) {
          errors.push(`Segment ${segIndex}: workoutSteps must not be empty`);
        }

        segment.workoutSteps.forEach((step, stepIndex) => {
          // stepId can be null
          if (step.stepId !== null && typeof step.stepId !== "number") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: stepId must be null or number`);
          }

          if (!step.stepName || typeof step.stepName !== "string") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: stepName (string)`);
          }

          if (!step.stepType || typeof step.stepType !== "object") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: stepType (object)`);
          } else {
            if (typeof step.stepType.stepTypeId !== "number") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: stepType.stepTypeId (number)`);
            }
            if (typeof step.stepType.stepTypeKey !== "string") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: stepType.stepTypeKey (string)`);
            }
          }

          if (!step.duration || typeof step.duration !== "object") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: duration (object)`);
          } else {
            if (typeof step.duration.type !== "string") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: duration.type (string)`);
            }
            if (typeof step.duration.value !== "number") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: duration.value (number)`);
            }
          }

          if (!step.intensity || typeof step.intensity !== "object") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: intensity (object)`);
          } else {
            if (typeof step.intensity.intensityId !== "number") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: intensity.intensityId (number)`);
            }
            if (typeof step.intensity.intensityKey !== "string") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: intensity.intensityKey (string)`);
            }
          }

          if (!step.targetType || typeof step.targetType !== "object") {
            errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: targetType (object)`);
          } else {
            if (typeof step.targetType.stepTargetId !== "number") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: targetType.stepTargetId (number)`);
            }
            if (typeof step.targetType.stepTargetKey !== "string") {
              errors.push(`Segment ${segIndex}, Step ${stepIndex}: Missing required field: targetType.stepTargetKey (string)`);
            }
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Generate a Garmin workout FIT file
 */
function generateWorkoutFile(options) {
  console.log(`Generating workout: "${options.name}"`);
  console.log(`Steps: ${options.steps.length}`);

  const encoder = new Encoder();
  const messages = buildWorkoutMessages(options);

  messages.forEach((msg) => {
    encoder.writeMesg(msg);
  });

  const uint8Array = encoder.close();
  return uint8Array;
}

/**
 * Main function
 */
function main() {
  try {
    const options = parseArgs();

    // Determine output paths and format
    const outputConfig = determineOutput(options.output, options.name);

    console.log(`🏃 Workout: "${options.name}"`);
    console.log(`   Steps: ${options.steps.length}`);
    console.log(`   Mode: ${outputConfig.formatMode.toUpperCase()}`);

    let fitBytes = null;
    let jsonOutput = null;
    let jsonValidation = null;

    // Generate FIT file if needed
    if (outputConfig.fitPath) {
      fitBytes = generateWorkoutFile(options);
    }

    // Generate JSON output if needed
    if (outputConfig.jsonPath) {
      jsonOutput = generateJsonOutput(options);
      jsonValidation = validateJsonOutput(jsonOutput);

      if (!jsonValidation.valid) {
        console.error(`❌ JSON validation errors:`);
        jsonValidation.errors.forEach(err => console.error(`   - ${err}`));
        // Don't fail - still write the file but warn
        console.warn(`⚠️  Warning: JSON output has validation issues`);
      }
    }

    // Write output files
    let filesWritten = [];

    if (outputConfig.fitPath && fitBytes) {
      fs.writeFileSync(outputConfig.fitPath, fitBytes);
      filesWritten.push({ path: outputConfig.fitPath, size: fitBytes.length, type: "FIT" });
    }

    if (outputConfig.jsonPath && jsonOutput) {
      const jsonString = JSON.stringify(jsonOutput, null, 2);
      fs.writeFileSync(outputConfig.jsonPath, jsonString, "utf8");
      filesWritten.push({ path: outputConfig.jsonPath, size: jsonString.length, type: "JSON" });
    }

    // Also output JSON content to stdout for easy copy/paste
    if (outputConfig.jsonPath && jsonOutput) {
      console.log("\n--- JSON OUTPUT (copy for Garmin Connect import) ---");
      console.log(JSON.stringify(jsonOutput, null, 2));
      console.log("--- END JSON OUTPUT ---");
      console.log("💡 Copy the JSON above and paste it into the fulippo Chrome extension to import to Garmin Connect\n");
    }

    // Summary
    console.log(`\n✅ Files written:`);
    filesWritten.forEach(f => {
      console.log(`   • ${f.path} (${f.type}, ${f.size} bytes)`);
    });

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("skill.js")) {
  main();
}

export {
  generateWorkoutFile,
  parseArgs,
  buildWorkoutMessages,
  generateJsonOutput,
  validateJsonOutput,
  determineOutput
};