---
name: garmin-workout
description: Generate Garmin-compatible workout files (.FIT and .JSON) for Garmin Connect and devices. Supports multi-step workouts with duration, intensity targets, and various exercise types. Compatible with fulippo/share-your-garmin-workout Chrome extension.
license: Garmin FIT SDK - SEE LICENSE IN LICENSE.txt
metadata:
  openclaw:
    emoji: "🏃"
    requires:
      bins: ["node"]
    install:
      - id: npm
        kind: node
        package: "@garmin/fitsdk"
        version: "^21.188.0"
        label: "Install Garmin FIT SDK"
---

# Garmin Workout Skill

Generate Garmin-compatible workout files for import into Garmin Connect or devices. Supports both `.FIT` binary format and JSON format compatible with the [fulippo/share-your-garmin-workout](https://github.com/fulippo/share-your-garmin-workout) Chrome extension.

## Usage

### Default: Generate both .FIT and .JSON files

```bash
# No --output specified → creates both workout.fit and workout.json in current directory
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js --name "Morning Run" --steps '[
  {"name": "Warm up", "duration": 300, "intensity": "warmup", "targetType": "heartRate", "targetMin": 120, "targetMax": 140},
  {"name": "Run", "duration": 1800, "intensity": "active", "targetType": "speed", "targetMin": 8, "targetMax": 10},
  {"name": "Cool down", "duration": 300, "intensity": "cooldown", "targetType": "heartRate", "targetMin": 100, "targetMax": 120}
]'
```

### Output path determines format

```bash
# Output ends in .fit → creates only .FIT file
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js --name "Run" --output /tmp/run.fit --steps '[{"name": "Run", "duration": 1800, "intensity": "active"}]'

# Output ends in .json → creates only .JSON file
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js --name "Run" --output /tmp/run.json --steps '[{"name": "Run", "duration": 1800, "intensity": "active"}]'

# Output is a directory → creates both .fit and .json in that directory
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js --name "Run" --output /tmp/workouts/ --steps '[{"name": "Run", "duration": 1800, "intensity": "active"}]'
```

### All options

```bash
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js \
  --name "HIIT Session" \
  --output /tmp/hiit.fit \
  --sport running \
  --steps '[
    {"name": "Warm up", "duration": 300, "intensity": "warmup", "targetType": "heartRate", "targetMin": 110, "targetMax": 130},
    {"name": "Sprint", "duration": 60, "intensity": "active", "targetType": "heartRate", "targetMin": 160, "targetMax": 175},
    {"name": "Rest", "duration": 60, "intensity": "rest", "targetType": "heartRate", "targetMin": 100, "targetMax": 120}
  ]'
```

## Options

| Option | Description |
|--------|-------------|
| `--name` | Workout name (required) |
| `--output` | Output path, file, or directory (optional - default creates both) |
| `--steps` | JSON array of workout steps (required) |
| `--sport` | Sport type (default: "running") |
| `--subSport` | Sub-sport type (default: "generic") |

## Output Behavior

### Files Written

The skill writes files to disk based on the output specification:

| Output Specified | Creates |
|-----------------|---------|
| None (default) | `workout-name.fit` and `workout-name.json` in current directory |
| `/path/file.fit` | `/path/file.fit` only |
| `/path/file.json` | `/path/file.json` only |
| `/path/dir/` | `/path/dir/workout-name.fit` and `/path/dir/workout-name.json` |

### JSON Output to stdout

When generating JSON output, the skill **also prints the full JSON content to stdout** after writing the file. This allows users to copy/paste the JSON directly into the Chrome extension import without needing to read the file.

**Important:** When using this skill, always include the JSON output (between the `--- JSON OUTPUT ---` markers) in your response to the user. The JSON string should be part of the assistant's response output so users can easily copy/paste it for Garmin Connect import.

Example output:
```
✅ Files written:
   • test-run.json (JSON, 456 bytes)

--- JSON OUTPUT (copy for Garmin Connect import) ---
{
  "workoutName": "Test Run",
  "sportType": {
    "sportTypeId": 1,
    "sportTypeKey": "running"
  },
  ...
}
--- END JSON OUTPUT ---
```

This is especially useful for workflows where you want to pipe or capture the JSON output:
```bash
node scripts/skill.js --name "Run" --steps '[...]' | jq '.workoutName'

## Step Object Fields

Each step in the steps array requires:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step name |
| `duration` | number | Duration in seconds |
| `intensity` | string | Intensity: "warmup", "active", "cooldown", "rest" |
| `targetType` | string | Target metric: "heartRate", "speed", "power", "cadence", "pace" (optional) |
| `targetMin` | number | Minimum target value (FIT only, optional) |
| `targetMax` | number | Maximum target value (FIT only, optional) |
| `durationType` | string | Duration type: "time" (default) or "distance" (optional) |

## JSON Schema (for fulippo Chrome Extension)

The JSON output follows the exact schema used by the [fulippo/share-your-garmin-workout](https://github.com/fulippo/share-your-garmin-workout) Chrome extension.

### JSON Output Example

```json
{
  "workoutName": "Morning Run",
  "sportType": {
    "sportTypeId": 1,
    "sportTypeKey": "running"
  },
  "workoutSegments": [{
    "segmentOrder": 1,
    "workoutSteps": [
      {
        "stepId": null,
        "stepName": "Warm up",
        "stepType": {
          "stepTypeId": 3,
          "stepTypeKey": "time"
        },
        "duration": {
          "type": "time",
          "value": 300
        },
        "intensity": {
          "intensityId": 0,
          "intensityKey": "warmup"
        },
        "targetType": {
          "stepTargetId": 0,
          "stepTargetKey": "noTarget"
        }
      }
    ]
  }]
}
```

### JSON Schema Reference

| Field | Type | Description |
|-------|------|-------------|
| `workoutName` | string | Name of the workout |
| `sportType` | object | Sport type with `sportTypeId` and `sportTypeKey` |
| `workoutSegments` | array | Array of workout segments |

### Sport Types

| Sport | sportTypeId | sportTypeKey |
|-------|-------------|--------------|
| running | 1 | running |
| cycling | 2 | cycling |
| swimming | 4 | swimming |
| walking | 8 | walking |
| fitness | 12 | fitness |
| strength | 13 | strength |
| cardio | 15 | cardio |
| hiking | 18 | hiking |
| rowing | 19 | rowing |
| elliptical | 21 | elliptical |
| stairClimbing | 22 | stairClimbing |

### Step Types

| Type | stepTypeId | stepTypeKey |
|------|-------------|-------------|
| time | 3 | time |
| distance | 1 | distance |

### Intensities

| Intensity | intensityId | intensityKey |
|-----------|-------------|--------------|
| warmup | 0 | warmup |
| active | 1 | active |
| cooldown | 2 | cooldown |
| rest | 3 | rest |

### Target Types

| Target | stepTargetId | stepTargetKey |
|--------|---------------|---------------|
| noTarget | 0 | noTarget |
| heartRate | 2 | heartRate |
| speed | 3 | speed |
| power | 5 | power |
| cadence | 7 | cadence |
| pace | 9 | pace |

## Validation

### FIT Validation

- Uses official `@garmin/fitsdk` package for encoding
- Generates standard Garmin FIT profile-compliant files
- All messages are validated against FIT profile definitions
- Compatible with Garmin's validation requirements

### JSON Validation

The skill includes built-in JSON schema validation that checks:

- **Required top-level fields**: `workoutName`, `sportType`, `workoutSegments`
- **Sport type**: Valid `sportTypeId` and `sportTypeKey`
- **Workout segments**: Non-empty array with valid segment order
- **Step validation** per step:
  - `stepId` (can be null or number)
  - `stepName` (string)
  - `stepType` with `stepTypeId` and `stepTypeKey`
  - `duration` with `type` and `value`
  - `intensity` with `intensityId` and `intensityKey`
  - `targetType` with `stepTargetId` and `stepTargetKey`

Validation runs automatically when generating JSON output and reports any issues.

## Import to Garmin Connect

### Option 1: Direct Import (.FIT files)

1. Generate the .FIT file
2. Open Garmin Connect at [connect.garmin.com](https://connect.garmin.com)
3. Go to **Training > Workouts**
4. Click **Import** and select the generated .FIT file
5. Sync to your device

### Option 2: JSON Import (with Chrome extension)

1. Generate the JSON file (specify output ending in `.json`)
2. Install the [fulippo/share-your-garmin-workout](https://github.com/fulippo/share-your-garmin-workout) Chrome extension
3. Open Garmin Connect at [connect.garmin.com](https://connect.garmin.com)
4. Go to **Training > Workouts**
5. Click **Import Workout** (added by the extension)
6. Select the generated JSON file
7. The workout will be imported directly to your Garmin Connect account

## Supported Sports

| Sport | Valid Values |
|-------|-------------|
| `running` | generic, trail, road, track, treadmill |
| `cycling` | generic, road, mountain, cross, indoor, elliptical |
| `swimming` | generic, openWater, pool |
| `walking` | generic, hiking, nordic |
| `fitness` | generic, indoor, outdoor |
| `strength` | generic |
| `cardio` | generic, indoor, outdoor |
| `hiking` | generic, trail, mountain |
| `rowing` | generic, indoor, openWater |
| `elliptical` | generic |
| `stairClimbing` | generic, stairClimbing, hillClimbing |

**Note:** Use standard Garmin enum values. Custom values like "interval" are not valid.

## Examples

### Simple 30-minute run (both formats)

```bash
# Creates morning-run.fit and morning-run.json
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js \
  --name "Easy Run" \
  --steps '[{"name": "Run", "duration": 1800, "intensity": "active", "targetType": "speed", "targetMin": 8, "targetMax": 10}]'
```

### Interval workout (.FIT only)

```bash
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js \
  --name "HIIT Session" \
  --output /tmp/hiit.fit \
  --steps '[
    {"name": "Warm up", "duration": 300, "intensity": "warmup", "targetType": "heartRate", "targetMin": 110, "targetMax": 130},
    {"name": "Sprint", "duration": 60, "intensity": "active", "targetType": "heartRate", "targetMin": 160, "targetMax": 175},
    {"name": "Rest", "duration": 60, "intensity": "rest", "targetType": "heartRate", "targetMin": 100, "targetMax": 120},
    {"name": "Cool down", "duration": 300, "intensity": "cooldown", "targetType": "heartRate", "targetMin": 110, "targetMax": 130}
  ]'
```

### JSON for Chrome extension import

```bash
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js \
  --name "Tempo Run" \
  --output /tmp/tempo-run.json \
  --steps '[
    {"name": "Warm up", "duration": 600, "intensity": "warmup"},
    {"name": "Tempo", "duration": 1200, "intensity": "active"},
    {"name": "Cool down", "duration": 600, "intensity": "cooldown"}
  ]'
```

### Cycling workout (both formats in custom directory)

```bash
node /home/claw/.openclaw/workspace/skills/garmin-workout/skill.js \
  --name "FTP Test" \
  --output /tmp/garmin-workouts/ \
  --sport cycling \
  --steps '[
    {"name": "Warm up", "duration": 600, "intensity": "warmup"},
    {"name": "Build", "duration": 300, "intensity": "active"},
    {"name": "All out", "duration": 1200, "intensity": "active"},
    {"name": "Recovery", "duration": 300, "intensity": "rest"},
    {"name": "All out", "duration": 1200, "intensity": "active"},
    {"name": "Cool down", "duration": 600, "intensity": "cooldown"}
  ]'
```

## Implementation

Uses the official `@garmin/fitsdk` package to encode valid FIT files:

- Requires Node.js v14+
- Generates standard Garmin workout files
- Compatible with all Garmin devices that support custom workouts
- Automatic JSON schema validation for JSON output

## Notes

- Use standard Garmin enum values for sport, subSport, intensity, and targetType
- Invalid enum values will cause errors - always use valid FIT profile values
- The skill generates compliant .FIT files that pass Garmin's validation checks
- JSON validation runs automatically and reports issues without failing
- Default behavior generates both formats for maximum compatibility