import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
  Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import ModelViewer from "../components/ModelViewer";
import { useTextToSpeech } from '../components/useTextToSpeech';

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
  { key: "SOGIESC", icon: "transgender-outline" },
];

const words = {
  Alphabet: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
  Numbers: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  "Basic Expressions": ["Bye", "Good afternoon", "Good evening", "Good morning", "See you later", "See you tomorrow"],
  "SOGIESC": ["Anti-discrimination ordinance", "Bisexual", "Cisgender", "Feminine", "Gay", "Genderqueer", "Lesbian", "Masculine", "Sexual orientation", "SOGIESC", "Transgender"],
};

const models = {
  0: [require("../../assets/models/numbers/0.glb")],
  1: [require("../../assets/models/numbers/1.glb")],
  2: [require("../../assets/models/numbers/2.glb")],
  3: [require("../../assets/models/numbers/3.glb")],
  4: [require("../../assets/models/numbers/4.glb")],
  5: [require("../../assets/models/numbers/5.glb")],
  6: [require("../../assets/models/numbers/6.glb")],
  7: [require("../../assets/models/numbers/7.glb")],
  8: [require("../../assets/models/numbers/8.glb")],
  9: [require("../../assets/models/numbers/9.glb")],
  "A": [require("../../assets/models/alphabet/A.glb")],
  "B": [require("../../assets/models/alphabet/B.glb")],
  "C": [require("../../assets/models/alphabet/C.glb")],
  "D": [require("../../assets/models/alphabet/D.glb")],
  "E": [require("../../assets/models/alphabet/E.glb")],
  "F": [require("../../assets/models/alphabet/F.glb")],
  "G": [require("../../assets/models/alphabet/G.glb")],
  "H": [require("../../assets/models/alphabet/H.glb")],
  "I": [require("../../assets/models/alphabet/I.glb")],
  "J": [require("../../assets/models/alphabet/J.glb")],
  "K": [require("../../assets/models/alphabet/K.glb")],
  "L": [require("../../assets/models/alphabet/L.glb")],
  "M": [require("../../assets/models/alphabet/M.glb")],
  "N": [require("../../assets/models/alphabet/N.glb")],
  "Ñ": [require("../../assets/models/alphabet/Ñ.glb")],
  "O": [require("../../assets/models/alphabet/O.glb")],
  "P": [require("../../assets/models/alphabet/P.glb")],
  "Q": [require("../../assets/models/alphabet/Q.glb")],
  "R": [require("../../assets/models/alphabet/R.glb")],
  "S": [require("../../assets/models/alphabet/S.glb")],
  "T": [require("../../assets/models/alphabet/T.glb")],
  "U": [require("../../assets/models/alphabet/U.glb")],
  "V": [require("../../assets/models/alphabet/V.glb")],
  "W": [require("../../assets/models/alphabet/W.glb")],
  "X": [require("../../assets/models/alphabet/X.glb")],
  "Y": [require("../../assets/models/alphabet/Y.glb")],
  "Z": [require("../../assets/models/alphabet/Z.glb")],
  "Bye": [require("../../assets/models/basic-expressions/bye.glb")],
  "Good afternoon": [require("../../assets/models/basic-expressions/good_afternoon.glb")],
  "Good evening": [require("../../assets/models/basic-expressions/good_evening.glb")],
  "Good morning": [require("../../assets/models/basic-expressions/good_morning.glb")],
  "See you later": [require("../../assets/models/basic-expressions/see_you_later.glb")],
  "See you tomorrow": [require("../../assets/models/basic-expressions/see_you_tomorrow.glb")],
  "Anti-discrimination ordinance": [require("../../assets/models/sogiesc/anti_discrimination_ordinance.glb")],
  "Bisexual": [require("../../assets/models/sogiesc/bisexual.glb")],
  "Cisgender": [require("../../assets/models/sogiesc/cisgender.glb")],
  "Feminine": [require("../../assets/models/sogiesc/feminine.glb")],
  "Gay": [require("../../assets/models/sogiesc/gay.glb")],
  "Genderqueer": [require("../../assets/models/sogiesc/genderqueer.glb")],
  "Lesbian": [require("../../assets/models/sogiesc/lesbian.glb")],
  "Masculine": [require("../../assets/models/sogiesc/masculine.glb")],
  "Sexual orientation": [require("../../assets/models/sogiesc/sexual_orientation.glb")],
  "SOGIESC": [require("../../assets/models/sogiesc/sogiesc.glb")],
  "Transgender": [require("../../assets/models/sogiesc/transgender.glb")],
}

const thumbnails = {
  'A': require("../../assets/thumbnails/a.png")
}

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("Alphabet");
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const speedOptions = [0.25, 0.5, 1, 2.5, 10];

  useEffect(() => {
    const preloadAllModels = async () => {
      const allAssets = Object.values(models)
        .flat()
        .map((m) => Asset.fromModule(m).downloadAsync());
      await Promise.all(allAssets);
      console.log("✅ All models preloaded");
    };
    preloadAllModels();
  }, []);


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

  const { speak, stop } = useTextToSpeech();
  useEffect(() => {
    if (selectedWord) {
      stop();          // stop any previous speech
      speak(selectedWord);
    }

    // stop speaking when leaving / switching
    return () => stop();
  }, [selectedWord]);

  useEffect(() => {
    return () => stop();
  }, []);


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
              renderItem={({ item, index }) => {
                const thumbnail = thumbnails[item];
                return (
                  <TouchableOpacity
                    style={styles.wordCard}
                    onPress={() => setSelectedWordIndex(index)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.animationBox}>
                      {thumbnail ? (
                        <Image source={thumbnail} style={styles.thumbnailImage} />
                      ) : (
                        <View style={styles.placeholderBox}>
                          <Ionicons name="cube-outline" size={50} color="#A8A8A8" />
                          <Text style={styles.thumbnailText}>Not yet available</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.wordText}>{item}</Text>
                  </TouchableOpacity>
                );
              }}
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
                    key={selectedWord} // ensures re-render for new model
                    ref={modelRef}
                    source={selectedWord && models[selectedWord] ? models[selectedWord][0] : null}
                    animationSpeed={animationSpeed}
                    rotationSpeed={0}
                  />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Ionicons name="cube-outline" size={80} color="#A8A8A8" />
                    <Text style={styles.placeholderText}>3D Model Coming Soon</Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 10 }}>
                  {speedOptions.map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      onPress={() => setAnimationSpeed(speed)}
                      style={{
                        backgroundColor: animationSpeed === speed ? "#E64C3C" : "#E0E0E0",
                        paddingVertical: 3,
                        paddingHorizontal: 8,
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
                  onPress={() => {
                    modelRef.current?.replay();
                    if (selectedWord) {
                      stop();
                      speak(selectedWord);
                    }
                  }}
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
    paddingBottom: 16,
  },
  wordCard: {
    width: (width - 70 - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E64C3C",
    alignItems: "center",
  },
  animationBox: {
    width: "100%",
    aspectRatio: 1, // makes it a perfect square
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain", // or "cover" if you want it to fill the box
  },
  placeholderBox: {
    width: "100%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
  },
  thumbnailText: {
    color: "#A8A8A8",
    fontSize: 12,
    marginTop: 6,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E64C3C",
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
