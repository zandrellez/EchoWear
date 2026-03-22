import serial
import numpy as np
from tensorflow.keras.models import load_model
import time

SERIAL_PORT = 'COM9'  # Update if needed
BAUD_RATE = 115200
SEQUENCE_LENGTH = 30
FEATURES = 12
MODEL_PATH = 'assets/algorithm/gesture_model.h5'

# Load the trained model
model = load_model(MODEL_PATH)

# Open serial port
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
print(f"Listening on {SERIAL_PORT} for {SEQUENCE_LENGTH} frames...")

while True:
    input("\nPress ENTER to record a new gesture sequence...")
    frames = []
    print("Collecting frames...")
    while len(frames) < SEQUENCE_LENGTH:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            data = line.split(',')
            if len(data) == FEATURES:
                try:
                    frames.append([float(x) for x in data])
                except ValueError:
                    continue
    X_live = np.array(frames).reshape(1, SEQUENCE_LENGTH, FEATURES)
    pred = model.predict(X_live)
    pred_class = np.argmax(pred)
    print(f"Predicted class index: {pred_class} (probabilities: {pred[0]})")
    # Optionally, map index to label if you have the label list

ser.close()