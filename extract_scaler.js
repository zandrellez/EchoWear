#!/usr/bin/env node
/**
 * Extract pickle file contents using node-pickle or fallback to parsing
 * This is a workaround since the files are.pkl format
 */

const fs = require('fs');
const path = require('path');

// Try to use pickle parsing (Node might not have it, so we'll provide instructions)
console.log('=== EchoWear Scaler Extraction ===\n');

const algorithmDir = path.join(__dirname, 'assets', 'algorithm');
const scalerPath = path.join(algorithmDir, 'scaler.pkl');
const encoderPath = path.join(algorithmDir, 'label_encoder.pkl');

console.log('✓ Files detected in:', algorithmDir);
console.log('  - scaler.pkl:', fs.existsSync(scalerPath) ? '✅ Found' : '❌ Missing');
console.log('  - label_encoder.pkl:', fs.existsSync(encoderPath) ? '✅ Found' : '❌ Missing');
console.log('\n📋 To extract the scaling values, run this in Python:\n');

console.log(`
import pickle
import json

# Load scaler
with open('assets/algorithm/scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

print("MEAN:", scaler.mean_.tolist())
print("VARIANCE:", scaler.var_.tolist())

# Load label encoder
with open('assets/algorithm/label_encoder.pkl', 'rb') as f:
    encoder = pickle.load(f)
    
print("CLASSES:", list(encoder.classes_))
`);
