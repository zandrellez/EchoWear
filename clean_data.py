import os
import glob
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder

DATASET_DIR = 'dataset'
FRAMES_PER_SEQUENCE = 30
FEATURES_COUNT = 11

def main():
    print("🧹 Starting Data Cleaning and Tensor Generation...")
    
    # 1. Find all CSV files in the dataset folder and its subfolders
    csv_files = glob.glob(os.path.join(DATASET_DIR, '**', '*.csv'), recursive=True)
    print(f"📄 Found {len(csv_files)} total recordings.")

    raw_sequences = []
    labels = []
    dropped_files = 0

    # 2. Extract and Validate the Data
    for file in csv_files:
        try:
            # Read the CSV (Assuming no header row since Python appended data directly)
            df = pd.read_csv(file, header=None)
            
            # Integrity Check 1: Exactly 30 frames
            if len(df) != FRAMES_PER_SEQUENCE:
                dropped_files += 1
                continue
                
            # Integrity Check 2: Exactly 12 columns (1 label + 11 sensors)
            if len(df.columns) != 12:
                dropped_files += 1
                continue
                
            # Integrity Check 3: No empty/NaN values
            if df.isnull().values.any():
                dropped_files += 1
                continue

            # Separate the label (Column 0) from the sensor data (Columns 1-11)
            sequence_label = str(df.iloc[0, 0]).strip().upper()
            sequence_data = df.iloc[:, 1:].values.astype(float)

            raw_sequences.append(sequence_data)
            labels.append(sequence_label)

        except Exception as e:
            dropped_files += 1
            continue

    print(f"🗑️ Dropped {dropped_files} corrupted or incomplete files.")
    print(f"✅ Successfully loaded {len(raw_sequences)} clean sequences.")

    # Convert lists to NumPy arrays
    X = np.array(raw_sequences) # Shape will be (Samples, 30, 11)
    y = np.array(labels)        # Shape will be (Samples,)

    # 3. Z-Score Standardization (Only on the IMU data)
    # Flex sensors are columns 0-4. IMU sensors are columns 5-10.
    print("⚖️ Standardizing IMU Sensor outputs...")
    
    # We must reshape X to 2D to apply the scaler, then reshape it back to 3D
    samples, time_steps, features = X.shape
    X_reshaped = X.reshape(-1, features)
    
    imu_scaler = StandardScaler()
    # Fit and transform ONLY the IMU columns (index 5 to 10)
    X_reshaped[:, 5:11] = imu_scaler.fit_transform(X_reshaped[:, 5:11])
    
    # Reshape back to strict 3D Tensor format for the LSTM
    X_clean = X_reshaped.reshape(samples, time_steps, features)

    # 4. Label Encoding (Convert 'A', 'B', 'C' to 0, 1, 2)
    print("🔤 Translating FSL text labels to numeric categories...")
    label_encoder = LabelEncoder()
    y_clean = label_encoder.fit_transform(y)
    
    # Save the mapping so you know which number belongs to which letter later
    label_mapping = dict(zip(label_encoder.classes_, label_encoder.transform(label_encoder.classes_)))
    print(f"🏷️ Label Mapping: {label_mapping}")

    # 5. Save the final AI-ready Tensors
    np.save('X_features.npy', X_clean)
    np.save('y_labels.npy', y_clean)
    
    print("\n==================================================")
    print(f"🚀 CLEANING COMPLETE! Data is ready for the LSTM.")
    print(f"X Shape (Input):  {X_clean.shape} -> (Samples, Time-Steps, Sensors)")
    print(f"y Shape (Output): {y_clean.shape} -> (Samples,)")
    print("Files saved as 'X_features.npy' and 'y_labels.npy'")
    print("==================================================")

if __name__ == '__main__':
    main()