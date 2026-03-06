import pickle
import json

# Load scaler
with open('assets/algorithm/scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

# Load label encoder
with open('assets/algorithm/label_encoder.pkl', 'rb') as f:
    encoder = pickle.load(f)

# Convert to lists for JSON
scaler_data = {
    "mean": scaler.mean_.tolist(),
    "variance": scaler.var_.tolist(),
    "scale": scaler.scale_.tolist(),
    "num_features": len(scaler.mean_)
}

print("=== SCALER ===")
print(f"Mean: {scaler_data['mean']}")
print(f"Variance: {scaler_data['variance']}")
print(f"Num Features: {scaler_data['num_features']}")
print()

print("=== LABEL ENCODER ===")
print(f"Classes: {list(encoder.classes_)}")
print(f"Num Classes: {len(encoder.classes_)}")

# Save to JSON file
with open('assets/algorithm/scaler.json', 'w') as f:
    json.dump(scaler_data, f, indent=2)

print("\n✅ Saved scaler.json")
