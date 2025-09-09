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
import Thumbnail from "../components/Thumbnail";
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
  Alphabet: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
  Numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "30", "40", "50", "60", "70", "80", "90", "100", "1000"],
  "Basic Expressions": ["Come here", "Don’t know", "Don’t understand", "Ewan", "Excuse me", "Know", "Mano po", "No", "OK", "Please", "Sana", "Sorry", "Understand", "Uy", "Wait", "What?", "When?", "Why?", "Wrong", "Yes"],
  "Greetings & Farewells": ["Bye", "Good afternoon", "Good evening", "Good morning", 'Good', "night", "See you later", "See you tomorrow"],
  "Time & Frequency": ["Absent", "Age", "Always", "Birthday", "Late", "Later", "Never", "Recent", "Tomorrow", "Yesterday"],
  "Physical Appearance": ["Beauty eyes", "Dimple", "Long hair", "Mole", "Nose", "Short", "Straight hair", "Tall"],
  "Gender & Sexuality": ["Anti-discrimination ordinance", "Bisexual", "Cisgender", "Feminine", "Gay", "Genderqueer", "Lesbian", "Masculine", "Sexual character", "Sexual orientation", "SOGIESC", "Transgender", "Transman", "Transwoman"],
};

const models = {
    1: [require("../assets/models/numbers/1.glb")],
    "A": [require("../assets/models/numbers/Thank you.glb")],
}

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("Alphabet");
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);

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
                    <Thumbnail source={models[item]?.[0]} zoom={20} />
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
            {models[selectedWord] ? (
                <ModelViewer 
                ref={modelRef} 
                zoom={12} 
                source={models[selectedWord][0]} 
                />
            ) : (
                <View style={styles.placeholderBox}>
                <Ionicons name="cube-outline" size={80} color="#A8A8A8" />
                <Text style={styles.placeholderText}>3D Model Coming Soon</Text>
                </View>
            )}
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
        justifyContent: "center", 
        alignItems: "center" 
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
