# --- EchoWear: Interval Data Collector (With Live Debug Preview) ---
import serial
import csv
import sys
import time
import os

SERIAL_PORT = 'COM9' 
BAUD_RATE = 115200
DATASET_DIR = 'dataset'

FRAMES_PER_SEQUENCE = 30  
PREP_TIME = 3             

def countdown(seconds, message):
    for i in range(seconds, 0, -1):
        sys.stdout.write(f"\r⏳ {message} in {i} seconds...")
        sys.stdout.flush()
        time.sleep(1)
    print("\n")

def calibrate_sensors(ser):
    print("\n==================================================")
    print(" 🖐️ SENSOR CALIBRATION PHASE")
    print("==================================================")
    input("👉 Put the glove on. Hold your hand STRAIGHT, then press ENTER...")
    ser.reset_input_buffer()
    countdown(5, "Keep hand straight, then open and close fist repeatedly")
    print("✅ Hardware Calibration Complete! Ready for FSL recording.")

def main():
    os.makedirs(DATASET_DIR, exist_ok=True)
    
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"✅ SUCCESS: Connected to {SERIAL_PORT}")
        time.sleep(2) 
    except serial.SerialException:
        print(f"\n❌ CRITICAL ERROR: Could not connect to {SERIAL_PORT}.")
        sys.exit(1)

    try:
        calibrate_sensors(ser)

        while True:
            print("\n==================================================")
            target_label = input("📝 Enter the FSL sign you want to record (or 'exit' to quit): ").strip()
            if target_label.lower() == 'exit':
                break
            if not target_label:
                continue

            label_dir = os.path.join(DATASET_DIR, target_label)
            os.makedirs(label_dir, exist_ok=True)

            try:
                num_sequences = int(input("🔢 How many times will you repeat this sign? (e.g., 50): "))
            except ValueError:
                print("❌ Please enter a valid number.")
                continue

            ser.write((target_label + '\n').encode('utf-8'))
            countdown(PREP_TIME, f"Get your hands ready for '{target_label.upper()}'")

            for sequence_num in range(1, num_sequences + 1):
                ser.reset_input_buffer()

                print(f"🔴 RECORDING Sequence {sequence_num}/{num_sequences}...")
                valid_frames_captured = 0
                sequence_data = []

                while valid_frames_captured < FRAMES_PER_SEQUENCE:
                    if ser.in_waiting > 0:
                        raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
                        
                        if raw_line and ">>>" not in raw_line:
                            data_array = raw_line.split(',')
                            if len(data_array) == 11:
                                sequence_data.append([target_label] + data_array)
                                valid_frames_captured += 1
                                
                                # --- THE NEW LIVE DEBUG PREVIEW ---
                                # This formats the frame number to always be two digits (e.g., 01, 02) for clean alignment
                                print(f"   [Frame {valid_frames_captured:02d}/30] {raw_line}")

                import datetime
                timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                sequence_filename = f"{timestamp}_{target_label}.csv"
                sequence_path = os.path.join(label_dir, sequence_filename)
                
                with open(sequence_path, mode='w', newline='') as seq_file:
                    writer = csv.writer(seq_file)
                    writer.writerows(sequence_data)

                print(f"✅ Sequence {sequence_num} Saved as {sequence_filename}!")

                if sequence_num < num_sequences:
                    user_cmd = input("Press ENTER for next sequence (or type 'RESET' if sensors hit 0): ").strip().upper()
                    
                    if user_cmd == "RESET":
                        ser.write(b'RESET\n')
                        calibrate_sensors(ser)
                        ser.write((target_label + '\n').encode('utf-8'))
                        countdown(2, "Resuming recording mode")

    except KeyboardInterrupt:
        print("\n\n⚠️ Process interrupted by user.")
    finally:
        ser.write(('Idle\n').encode('utf-8')) 
        ser.close()
        print("\n==================================================")
        print(f"🛑 Port closed. All data safely saved to {DATASET_DIR}.")
        print("==================================================")

if __name__ == '__main__':
    main()