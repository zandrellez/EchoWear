import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, BackHandler, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import WordFocus from "../components/WordFocus"; 

const { width } = Dimensions.get("window");

// 1. DEFINE ASSETS SAFELY
const categoryAssets = {
  "Alphabet": require("../../assets/models/ALPHABET.glb"),
  "Numbers": require("../../assets/models/NUMBERS.glb"),
  // "Basic Expressions": require("../../assets/models/BASIC_EXPRESSIONS.glb"),
  "Greetings & Farewells": require("../../assets/models/GREETINGS_FAREWELLS.glb"),
  "Time & Frequency": require("../../assets/models/TIME_FREQUENCY.glb"),
  "Physical Appearance": require("../../assets/models/PHYSICAL_APPEARANCE.glb"),
  "SOGIESC": require("../../assets/models/SOGIESC.glb"),
} 

const animationMap = {
  // Alphabet
  A: "Letter_A",
  B: "Letter_B",
  C: "Letter_C",
  D: "Letter_D",
  E: "Letter_E",
  F: "Letter_F",
  G: "Letter_G",
  H: "Letter_H",
  I: "Letter_I",
  J: "Letter_J",
  K: "Letter_K",
  L: "Letter_L",
  M: "Letter_M",
  N: "Letter_N",
  Ñ: "Letter_Nye",
  O: "Letter_O",
  P: "Letter_P",
  Q: "Letter_Q",
  R: "Letter_R",
  S: "Letter_S",
  T: "Letter_T",
  U: "Letter_U",
  V: "Letter_V",
  W: "Letter_W",
  X: "Letter_X",
  Y: "Letter_Y",
  Z: "Letter_Z",

  // Numbers
  0: "Number_0",
  1: "Number_1",
  2: "Number_2",
  3: "Number_3",
  4: "Number_4",
  5: "Number_5",
  6: "Number_6",
  7: "Number_7",
  8: "Number_8",
  9: "Number_9",

  // Basic Expressions

  // Greetings & Farewells

  // Time & Frequency

  //Physical Appearance
  "Tall": "PA_Tall",
  "Straight Hair": "PA_StraightHair",
  "Nose": "PA_Nose",
  "Dimple": "PA_Dimple",
  "Long Hair": "PA_LongHair",
  "Short Hair": "PA_ShortHair",

  // SOGIESC
}

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
  Alphabet: [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
  ],
  Numbers: [
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
  ],
  "Basic Expressions": [
    "Come here", "Don’t Know", "Don’t understand", "Excuse me", 
    "Know", "Bless (Mano po)", "No", "OK", "Please", "Sorry", 
    "Understand", "Uy", "Wait", "What?", "When?", "Why?", "Wrong", "Yes"
  ],
  "Greetings & Farewells": [
    "Bye", "Good afternoon", "Good evening", "Good morning",
    "See you later", "See you tomorrow"
  ],
  "Time & Frequency": [
    "Absent", "Always", "Late", "Never", "Recent", "Later", "Yesterday", "Tomorrow"
  ],
  "Physical Appearance": [
    "Dimple", "Nose", "Long Hair", "Straight Hair", "Tall", "Short"
  ],
  "SOGIESC": [
    "Anti-discrimination ordinance", "Bisexual", "Cisgender", 
    "Feminine", "Gay", "Genderqueer", "Lesbian", "Masculine", 
    "Sexual orientation", "SOGIESC", "Transgender"
  ]
}

const thumbnails = {
  'A': require("../../assets/thumbnails/a.png")
}

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("Alphabet");
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);

  // SAFETY CHECK 1: Default to empty array if category is undefined
  const currentWords = words[selectedCategory] || [];
  const selectedWord = selectedWordIndex !== null ? currentWords[selectedWordIndex] : null;

  // SAFETY CHECK 2: Get Source safely
  const currentModelSource = categoryAssets[selectedCategory];

  useEffect(() => {
    // Only preload existing assets
    const assetsToLoad = Object.values(categoryAssets).filter(Boolean);
    if(assetsToLoad.length > 0) {
        const preloadModels = async () => {
            try {
                await Promise.all(assetsToLoad.map((m) => Asset.fromModule(m).downloadAsync()));
            } catch (e) {
                console.log("Preload warning:", e);
            }
        };
        preloadModels();
    }
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (selectedWordIndex !== null) {
        setSelectedWordIndex(null);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [selectedWordIndex]);

  const goNext = () => {
    if (selectedWordIndex < currentWords.length - 1) setSelectedWordIndex(selectedWordIndex + 1);
  };
  const goPrev = () => {
    if (selectedWordIndex > 0) setSelectedWordIndex(selectedWordIndex - 1);
  };

  // --- RENDER ---
  if (selectedWordIndex !== null) {
    return (
      <WordFocus 
        word={selectedWord}
        category={selectedCategory}
        // Pass null if source doesn't exist (e.g. for Numbers)
        modelSource={currentModelSource}
        animationName={animationMap[selectedWord] || selectedWord}
        onBack={() => setSelectedWordIndex(null)}
        onNext={goNext}
        onPrev={goPrev}
        canNext={selectedWordIndex < currentWords.length - 1}
        canPrev={selectedWordIndex > 0}
        wordList={currentWords}
        currentIndex={selectedWordIndex}
        onSelectWordFromModal={(index) => setSelectedWordIndex(index)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Library</Text>
      </View>

      <View style={styles.categoryContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.catPill, selectedCategory === item.key && styles.catPillActive]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Ionicons name={item.icon} size={20} color={selectedCategory === item.key ? "#FFF" : "#666"} />
              <Text style={[styles.catText, selectedCategory === item.key && {color:"#FFF"}]}>{item.key}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList 
        data={currentWords}
        keyExtractor={(item) => item}
        numColumns={3}
        contentContainerStyle={{padding: 10}}
        // Handle empty categories
        ListEmptyComponent={
            <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#999'}}>No words in this category yet.</Text>
            </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.wordCard} onPress={() => setSelectedWordIndex(index)}>
            <View style={styles.iconBox}>
               {/* Safety check for charAt */}
               <Text style={styles.wordLetter}>{item ? item.charAt(0) : "?"}</Text>
            </View>
            <Text style={styles.wordLabel}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  headerText: { fontSize: 28, fontWeight: "bold", color: "#333" },
  categoryContainer: { height: 60, paddingHorizontal: 10 },
  catPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 10, height: 40 },
  catPillActive: { backgroundColor: '#E64C3C' },
  catText: { marginLeft: 8, fontWeight: '600', color: '#666' },
  wordCard: { flex: 1, margin: 6, height: 110, backgroundColor: "#fff", borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F0F0F0", elevation: 2 },
  iconBox: { width: 45, height: 45, borderRadius: 25, backgroundColor: "#FFF0F0", justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  wordLetter: { fontSize: 20, fontWeight: "bold", color: "#E64C3C" },
  wordLabel: { fontSize: 14, fontWeight: "600", color: "#333" }
});