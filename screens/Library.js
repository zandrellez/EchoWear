import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
// import Thumbnail from "../components/Thumbnail";
import ModelViewer from "../components/ModelViewer";

const { width } = Dimensions.get("window");
const STATUSBAR_HEIGHT =
  Platform.OS === "ios" ? Constants.statusBarHeight : StatusBar.currentHeight || 0;

const categories = [
  { key: "Alphabet", icon: "text-outline" },
  { key: "Numbers", icon: "calculator-outline" },
  { key: "Basic Expressions", icon: "chatbubble-ellipses-outline" },
  { key: "Greetings & Farewells", icon: "hand-right-outline" },
  { key: "Time & Frequency", icon: "time-outline" },
  { key: "Physical Appearance", icon: "person-outline" },
  { key: "Gender, Sexuality & SOGIESC", icon: "transgender-outline" },
];

const words = {
  Alphabet: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
  Numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
  "Basic Expressions": ["Come here", "Don’t know", "Don’t understand", "Ewan", "Excuse me", "Know", "Mano po", "No", "OK", "Please", "Sana", "Sorry", "Understand", "Uy", "Wait", "What?", "When?", "Why?", "Wrong", "Yes"],
  "Greetings & Farewells": ["Bye", "Good afternoon", "Good evening", "Good morning", 'Good', "night", "See you later", "See you tomorrow"],
  "Time & Frequency": ["Absent", "Age", "Always", "Birthday", "Late", "Later", "Never", "Recent", "Tomorrow", "Yesterday"],
  "Physical Appearance": ["Beauty eyes", "Dimple", "Long hair", "Mole", "Nose", "Short", "Straight hair", "Tall"],
  "Gender & Sexuality": ["Anti-discrimination ordinance", "Bisexual", "Cisgender", "Feminine", "Gay", "Genderqueer", "Lesbian", "Masculine", "Sexual character", "Sexual orientation", "SOGIESC", "Transgender", "Transman", "Transwoman"],
};

const models = {
    1: [require("../assets/models/numbers/1.glb")],
    2: [require("../assets/models/numbers/2.glb")],
    3: [require("../assets/models/numbers/3.glb")],
    4: [require("../assets/models/numbers/4.glb")],
    5: [require("../assets/models/numbers/5.glb")],
    6: [require("../assets/models/numbers/6.glb")],
    7: [require("../assets/models/numbers/7.glb")],
    8: [require("../assets/models/numbers/8.glb")],
    9: [require("../assets/models/numbers/9.glb")],
    10: [require("../assets/models/numbers/10.glb")],
    11: [require("../assets/models/numbers/11.glb")],
    12: [require("../assets/models/numbers/12.glb")],
    13: [require("../assets/models/numbers/13.glb")],
    14: [require("../assets/models/numbers/14.glb")],
    15: [require("../assets/models/numbers/15.glb")],
    16: [require("../assets/models/numbers/16.glb")],
    17: [require("../assets/models/numbers/17.glb")],
    18: [require("../assets/models/numbers/18.glb")],
    19: [require("../assets/models/numbers/19.glb")],
    20: [require("../assets/models/numbers/20.glb")],
    30: [require("../assets/models/numbers/30.glb")],
    40: [require("../assets/models/numbers/40.glb")],
    50: [require("../assets/models/numbers/50.glb")],
    60: [require("../assets/models/numbers/60.glb")],
    70: [require("../assets/models/numbers/70.glb")],
    80: [require("../assets/models/numbers/80.glb")],
    90: [require("../assets/models/numbers/90.glb")],
    100: [require("../assets/models/numbers/100.glb")],
    "A": [require("../assets/models/alphabet/A.glb")],
    "B": [require("../assets/models/alphabet/B.glb")],
    "C": [require("../assets/models/alphabet/C.glb")],
    "D": [require("../assets/models/alphabet/D.glb")],
    "E": [require("../assets/models/alphabet/E.glb")],
    "F": [require("../assets/models/alphabet/F.glb")],
    "G": [require("../assets/models/alphabet/G.glb")],
    "H": [require("../assets/models/alphabet/H.glb")],
    "I": [require("../assets/models/alphabet/I.glb")],
    "J": [require("../assets/models/alphabet/J.glb")],
    "K": [require("../assets/models/alphabet/K.glb")],
    "L": [require("../assets/models/alphabet/L.glb")],
    "M": [require("../assets/models/alphabet/M.glb")],
    "N": [require("../assets/models/alphabet/N.glb")],
    "Ñ": [require("../assets/models/alphabet/Ñ.glb")],
    "O": [require("../assets/models/alphabet/O.glb")],
    "P": [require("../assets/models/alphabet/P.glb")],
    "Q": [require("../assets/models/alphabet/Q.glb")],
    "R": [require("../assets/models/alphabet/R.glb")],
    "S": [require("../assets/models/alphabet/S.glb")],
    "T": [require("../assets/models/alphabet/T.glb")],
    "U": [require("../assets/models/alphabet/U.glb")],
    "V": [require("../assets/models/alphabet/V.glb")],
    "W": [require("../assets/models/alphabet/W.glb")],
    "X": [require("../assets/models/alphabet/X.glb")],
    "Y": [require("../assets/models/alphabet/Y.glb")],
    "Z": [require("../assets/models/alphabet/Z.glb")],
}

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("Alphabet");
  const [selectedWordIndex, setSelectedWordIndex] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(1); 
  const speedOptions = [0.25, 0.5, 1, 2.5, 10];


  const currentWords = words[selectedCategory];
  const selectedWord =
    selectedWordIndex !== null ? currentWords[selectedWordIndex] : null;

  const goNext = () => {
    if (selectedWordIndex < currentWords.length - 1) {
      setSelectedWordIndex(selectedWordIndex + 1);
    }
  };

  const modelRef = useRef();

  const goPrev = () => {
    if (selectedWordIndex > 0) {
      setSelectedWordIndex(selectedWordIndex - 1);
    }
  };

  const resetView = () => setSelectedWordIndex(null);

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Library</Text>
      </View>

      {/* Two-Pane Layout */}
      <View style={styles.container}>
        {/* Left Panel (Icons) */}
        <View style={styles.leftPane}>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item.key;
              return (
                <TouchableOpacity
                  style={[styles.iconButton, isActive && styles.activeCategory]}
                  onPress={() => {
                    setSelectedCategory(item.key);
                    setSelectedWordIndex(null);
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={isActive ? "#E64C3C" : "#A8A8A8"}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Right Panel */}
        <View style={styles.wordsContainer}>
          {/* Category Header */}
          <View style={styles.categoryHeader}>
            {/* Left: Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={resetView}
              disabled={selectedWordIndex === null}
            >
              {selectedWordIndex !== null ? (
                <Ionicons name="chevron-back" size={24} color="#E64C3C" />
              ) : (
                <View style={{ width: 24 }} />
              )}
            </TouchableOpacity>

            {/* Center: Title */}
            <View style={styles.categoryTitleWrapper}>
              <Text style={styles.categoryTitle}>{selectedCategory}</Text>
            </View>

            {/* Right: Spacer (same width as back button) */}
            <View style={{ width: 24 }} />
          </View>


          {/* Word Grid OR Detail */}
          {selectedWordIndex === null ? (
            // Grid View
            <FlatList
              data={currentWords}
              keyExtractor={(item) => item}
              numColumns={2}
              contentContainerStyle={styles.wordList}
              columnWrapperStyle={{ justifyContent: "space-between" }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.wordCard}
                  onPress={() => setSelectedWordIndex(index)}
                >
                  <View style={styles.animationBox}>
                    {/* <Thumbnail source={models[item]?.[0]}  /> */}
                    <Text>haha</Text>
                  </View>
                  <Text style={styles.wordText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            // Detail View
            <View style={styles.detailView}>
              {/* Word Title */}
              <Text style={styles.detailWord}>{selectedWord}</Text>

              {/* Animation Box */}
              <View style={styles.bigAnimationBox}>
                {selectedWord && models[selectedWord] ? (
                  <ModelViewer 
                    ref={modelRef} 
                    source={models[selectedWord][0]}
                    animationSpeed={animationSpeed} 
                  />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Ionicons name="cube-outline" size={80} color="#A8A8A8" />
                    <Text style={styles.placeholderText}>3D Model Coming Soon</Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10 }}>
                  {speedOptions.map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      onPress={() => setAnimationSpeed(speed)}
                      style={{
                        backgroundColor: animationSpeed === speed ? "#007AFF" : "#E0E0E0",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 6,
                        marginHorizontal: 4,
                      }}
                    >
                      <Text style={{ color: animationSpeed === speed ? "white" : "black" }}>
                        {speed}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Controls Row */}
              <View style={styles.controls}>
                <TouchableOpacity
                  onPress={goPrev}
                  disabled={selectedWordIndex === 0}
                  style={styles.controlBtn}
                >
                  <Ionicons
                    name="chevron-back"
                    size={28}
                    color={selectedWordIndex === 0 ? "#ccc" : "#E64C3C"}
                  />
                  <Text
                    style={[
                      styles.controlText,
                      { color: selectedWordIndex === 0 ? "#ccc" : "#E64C3C" },
                    ]}
                  >
                    Prev
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                style={styles.replayBtn}
                onPress={() => modelRef.current?.replay()}
                >
                <Ionicons name="play-circle" size={50} color="#E64C3C" />
                <Text style={styles.controlText}>Replay</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  onPress={goNext}
                  disabled={selectedWordIndex === currentWords.length - 1}
                  style={styles.controlBtn}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={
                      selectedWordIndex === currentWords.length - 1
                        ? "#ccc"
                        : "#E64C3C"
                    }
                  />
                  <Text
                    style={[
                      styles.controlText,
                      {
                        color:
                          selectedWordIndex === currentWords.length - 1
                            ? "#ccc"
                            : "#E64C3C",
                      },
                    ]}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1, 
        paddingTop: STATUSBAR_HEIGHT, 
        backgroundColor: "#fff"
    },
    header: {
        height: 60,
        justifyContent: "center",
        alignItems: "center",
        borderBottomWidth: 1,
        borderColor: "#eee",
        backgroundColor: "#fff",
    },
    headerText: { 
        fontSize: 20, 
        fontWeight: "bold", 
        color: "#000" 
    },
    container: { 
        flex: 1, 
        flexDirection: "row" 
    },
    leftPane: { 
        width: 70, 
        borderRightWidth: 1, 
        borderColor: "#eee", 
        alignItems: "center" 
    },
    iconButton: { 
        padding: 15, 
        marginVertical: 5, 
        borderRadius: 10 
    },
    activeCategory: { 
        backgroundColor: "#FDECEA" 
    },
    wordsContainer: { 
        flex: 1, 
        padding: 16 
    },
    categoryHeader: { 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: 12 
    },
    backButton: { 
        width: 40, 
        alignItems: "center" 
    },
    categoryTitleWrapper: { 
        flex: 1, 
        alignItems: "center" 
    },
    categoryTitle: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#E64C3C" 
    },
    wordList: { 
        paddingBottom: 16 
    },
    wordCard: { 
        width: (width - 70 - 48) / 2, 
        backgroundColor: "#fff", 
        borderRadius: 12, 
        padding: 12, 
        marginBottom: 16, 
        borderWidth: 1, 
        borderColor: "#E64C3C", 
        alignItems: "center" 
    },
    animationBox: { 
        width: "100%", 
        height: 120, 
        backgroundColor: "#FDECEA", 
        borderRadius: 10, 
        marginBottom: 8, 
    },
    animationPlaceholder: { 
        color: "#A8A8A8", 
        fontSize: 12 
    },
    wordText: { 
        fontSize: 16, 
        fontWeight: "600", 
        color: "#E64C3C" 
    },
    detailView: { 
        flex: 1, 
        justifyContent: "space-between", 
        alignItems: "center", 
    },
    detailWord: { 
        fontSize: 26, 
        fontWeight: "bold", 
        color: "#000", 
        marginTop: 10 
    },
    bigAnimationBox: { 
        width: width - 100, 
        height: 400, 
        backgroundColor: "#FDECEA", 
        borderRadius: 15, 
        overflow: "hidden",
    },
    placeholderBox: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    placeholderText: {
        marginTop: 12,
        fontSize: 16,
        color: "#A8A8A8",
        fontStyle: "italic",
    },
    controls: { 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center", 
        width: "100%", 
        paddingHorizontal: 40, 
        marginBottom: 20 
    },
    controlBtn: { 
        alignItems: "center" 
    },
    replayBtn: { 
        alignItems: "center" 
    },
    controlText: { 
        fontSize: 14, 
        marginTop: 4 
    },
});
