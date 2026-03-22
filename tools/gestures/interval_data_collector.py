# --- EchoWear: Interval Data Collector with Calibration ---

import serial
import csv
import sys
import time
import os

SERIAL_PORT = 'COM9' 
BAUD_RATE = 115200
DATASET_DIR = 'dataset'
OUTPUT_FILE = f'{DATASET_DIR}/echowear_dataset.csv'

# ML Constraints
FRAMES_PER_SEQUENCE = 30  # 1.5 seconds of data (30 frames at 20Hz)
PREP_TIME = 3             # Seconds to prepare before the very first recording
REST_INTERVAL = 2         # Seconds to rest between each repetition

def countdown(seconds, message):
    for i in range(seconds, 0, -1):
        sys.stdout.write(f"\r⏳ {message} in {i} seconds...")
        sys.stdout.flush()
        time.sleep(1)
    print("\n")

def calibrate_sensors(ser):
    """Guides the user through the ESP32's hardware calibration phase."""
    print("\n==================================================")
    print(" 🖐️ SENSOR CALIBRATION PHASE")
    print("==================================================")
    # Wait for the user to be physically ready
    input("👉 Put the glove on. Hold your hand STRAIGHT, then press ENTER...")
    
    # Clear out any boot-up text from the ESP32
    ser.reset_input_buffer()
    
    # Give the user a 5-second window to set their 0% and 100% limits
    countdown(5, "Keep hand straight, then open and close fist repeatedly")
    print("✅ Hardware Calibration Complete! Ready for FSL recording.")

def main():
    while True:
        os.makedirs(DATASET_DIR, exist_ok=True)
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            print(f"✅ SUCCESS: Connected to {SERIAL_PORT}")
            time.sleep(2) # Give ESP32 a moment to stabilize after connection
        except serial.SerialException:
            print(f"\n❌ CRITICAL ERROR: Could not connect to {SERIAL_PORT}.")
            sys.exit(1)

        # --- Run the New Calibration Step ---
        calibrate_sensors(ser)

        while True:
            print("\n==================================================")
            target_label = input("📝 Enter the FSL sign you want to record (or 'exit' to quit): ").strip()
            if target_label.lower() == 'exit':
                break
            if not target_label:
                continue

            # Create a folder for the label if it doesn't exist
            label_dir = os.path.join(DATASET_DIR, target_label)
            os.makedirs(label_dir, exist_ok=True)

            try:
                num_sequences = int(input("🔢 How many times will you repeat this sign? (e.g., 50): "))
            except ValueError:
                print("❌ Please enter a valid number.")
                continue

            # Tell ESP32 what we are recording
            ser.write((target_label + '\n').encode('utf-8'))

            countdown(PREP_TIME, f"Get your hands ready for '{target_label.upper()}'")

            for sequence_num in range(1, num_sequences + 1):
                # CRITICAL RESILIENCE FIX: Clear the "stale" data from the rest period
                ser.reset_input_buffer()

                print(f"🔴 RECORDING Sequence {sequence_num}/{num_sequences}...")
                valid_frames_captured = 0
                sequence_data = []

                while valid_frames_captured < FRAMES_PER_SEQUENCE:
                    if ser.in_waiting > 0:
                        raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
                        print(f"[DEBUG] Received: {raw_line}")  # Debug print
                        if raw_line and ">>>" not in raw_line:
                            data_array = raw_line.split(',')
                            if len(data_array) == 12:
                                sequence_data.append(data_array)
                                valid_frames_captured += 1

                # Save the sequence immediately after recording
                import datetime
                timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                sequence_filename = f"{timestamp}_{target_label}.csv"
                sequence_path = os.path.join(label_dir, sequence_filename)
                with open(sequence_path, mode='w', newline='') as seq_file:
                    writer = csv.writer(seq_file)
                    writer.writerows(sequence_data)

                print(f"✅ Sequence {sequence_num} Saved as {sequence_filename}!")

                # Wait for user to press ENTER before next sequence
                if sequence_num < num_sequences:
                    input("Press ENTER when ready for the next sequence...")

        # Clean exit
        ser.write(('Idle\n').encode('utf-8')) # Tell ESP32 to stop streaming
        ser.close()
        print("\n==================================================")
        print(f"🛑 Port closed. All data safely saved to {DATASET_DIR}.")
        print("==================================================")

if __name__ == '__main__':
    main()