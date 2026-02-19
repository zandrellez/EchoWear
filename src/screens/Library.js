import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, BackHandler, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import WordFocus from "../components/WordFocus"; 

const { width } = Dimensions.get("window");

// --- LAYOUT CONFIG (2 COLUMNS) ---
const CONTAINER_PADDING = 16;
const CARD_MARGIN = 8;
// Calculation: (Screen Width - Container Padding) / 2 columns - Card Margins
const CARD_WIDTH = (width - (CONTAINER_PADDING * 2)) / 2 - (CARD_MARGIN * 2);

// 1. DEFINE ASSETS SAFELY
const categoryAssets = {
  "Alphabet": require("../../assets/models/ALPHABET.glb"),
  "Numbers": require("../../assets/models/NUMBERS.glb"),
  "Basic Expressions": require("../../assets/models/BASIC_EXPRESSIONS.glb"),
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
  // "Come here": "BE_ComeHere",
  // "Don’t Know": "BE_DontKnow",
  "Don’t understand": "BE_DON'TUNDERSTAND",
  // "Excuse me": "BE_ExcuseMe",
  "Know": "BE_KNOW",
  // "Bless (Mano po)": "BE_BlessManoPo",
  "No": "BE_NO",
  // "OK": "BE_OK",
  // "Please": "BE_Please",
  "Sorry": "BE_SORRY",
  // "Understand": "BE_Understand",
  // "Uy": "BE_Uy",
  "Wait": "BE_WAIT",
  "What?": "BE_WHAT",
  // "When?": "BE_When?",
  // "Why?": "BE_Why?",
  // "Wrong": "BE_Wrong",
  // "Yes": "BE_Yes",

  // Greetings & Farewells
  "Bye": "GaF_Bye",
  "Good afternoon": "GaF_GoodAfternoon",
  "Good evening": "GaF_GoodEvening",
  "Good morning": "GaF_GoodMorning",
  "See you later": "GaF_SeeYouLater",
  "See you tomorrow": "GaF_SeeYouTomorrow",

  // Time & Frequency
  "Absent": "TaF_Absent",
  "Always": "TaF_Always",
  "Late": "TaF_Late",
  "Never": "TaF_Never",
  "Recent": "TaF_Recent",
  "Later": "TaF_Later",
  "Yesterday": "TaF_Yesterday",
  "Tomorrow": "TaF_Tomorrow",

  //Physical Appearance
  "Tall": "PA_Tall",
  "Straight Hair": "PA_StraightHair",
  "Nose": "PA_Nose",
  "Dimple": "PA_Dimple",
  "Long Hair": "PA_LongHair",
  "Short": "PA_Short",

  // SOGIESC
  "Anti-discrimination Ordinance": "SOGIESC_Anti-discriminationOrdinance",
  "Bisexual": "SOGIESC_Bisexual",
  "Cisgender": "SOGIESC_Cisgender",
  "Feminine": "SOGIESC_Feminine",
  "Gay": "SOGIESC_Gay",
  "Genderqueer": "SOGIESC_Genderqueer",
  "Lesbian": "SOGIESC_Lesbian",
  "Sexual Orientation": "SOGIESC_SexualOrientation",
  "SOGIESC": "SOGIESC_SOGIESC",
  "Transgender": "SOGIESC_Transgender",  
  "Masculine": "SOGIESSC_Masculine",
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
    // "Come here", "Don’t Know",  "Excuse me", "Bless (Mano po)", 
    // "OK", "Please", "Understand", "Uy", , "When?", "Why?", 
    // "Wrong", "Yes"
    "Don’t understand", "Know",  "No", "Sorry", "Wait", "What?"
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
    "Sexual Orientation", "SOGIESC", "Transgender"
  ]
}

const modelThumbnails = {
  // Alphabet
  "A": require("../../assets/thumbnails/A.png"),
  "B": require("../../assets/thumbnails/B.png"),
  "C": require("../../assets/thumbnails/C.png"),
  "D": require("../../assets/thumbnails/D.png"),
  "E": require("../../assets/thumbnails/E.png"),
  "F": require("../../assets/thumbnails/F.png"),
  "G": require("../../assets/thumbnails/G.png"),
  "H": require("../../assets/thumbnails/H.png"),
  "I": require("../../assets/thumbnails/I.png"),
  "J": require("../../assets/thumbnails/J.png"),
  "K": require("../../assets/thumbnails/K.png"),
  "L": require("../../assets/thumbnails/L.png"),
  "M": require("../../assets/thumbnails/M.png"),
  "N": require("../../assets/thumbnails/N.png"),
  "Ñ": require("../../assets/thumbnails/Nye.png"), 
  "O": require("../../assets/thumbnails/O.png"),
  "P": require("../../assets/thumbnails/P.png"),
  "Q": require("../../assets/thumbnails/Q.png"),
  "R": require("../../assets/thumbnails/R.png"),
  "S": require("../../assets/thumbnails/S.png"),
  "T": require("../../assets/thumbnails/T.png"),
  "U": require("../../assets/thumbnails/U.png"),
  "V": require("../../assets/thumbnails/V.png"),
  "W": require("../../assets/thumbnails/W.png"),
  "X": require("../../assets/thumbnails/X.png"),
  "Y": require("../../assets/thumbnails/Y.png"),
  "Z": require("../../assets/thumbnails/Z.png"),

  // Numbers
  0: require("../../assets/thumbnails/0.png"),
  1: require("../../assets/thumbnails/1.png"),
  2: require("../../assets/thumbnails/2.png"),  
  3: require("../../assets/thumbnails/3.png"),
  4: require("../../assets/thumbnails/4.png"),
  5: require("../../assets/thumbnails/5.png"),
  6: require("../../assets/thumbnails/6.png"),
  7: require("../../assets/thumbnails/7.png"),
  8: require("../../assets/thumbnails/8.png"),
  9: require("../../assets/thumbnails/9.png"),

  // Basic Expressions
  "Don’t understand": require("../../assets/thumbnails/DontUnderstand.png"),
  "Know": require("../../assets/thumbnails/Know.png"),
  "No": require("../../assets/thumbnails/No.png"),
  "Sorry": require("../../assets/thumbnails/Sorry.png"),
  "Wait": require("../../assets/thumbnails/Wait.png"),
  "What?": require("../../assets/thumbnails/What.png"),

  // Greetings & Farewells
  "Bye": require("../../assets/thumbnails/Bye.png"),
  "Good afternoon": require("../../assets/thumbnails/GoodAfternoon.png"),
  "Good evening": require("../../assets/thumbnails/GoodEvening.png"),
  "Good morning": require("../../assets/thumbnails/GoodMorning.png"),
  "See you later": require("../../assets/thumbnails/SeeYouLater.png"),
  "See you tomorrow": require("../../assets/thumbnails/SeeYouTomorrow.png"),

  // TIme & Frequency
  "Absent": require("../../assets/thumbnails/Absent.png"),
  "Always": require("../../assets/thumbnails/Always.png"),
  "Late": require("../../assets/thumbnails/Late.png"),
  "Never": require("../../assets/thumbnails/Never.png"),
  "Recent": require("../../assets/thumbnails/Recent.png"),
  "Later": require("../../assets/thumbnails/Later.png"),
  "Yesterday": require("../../assets/thumbnails/Yesterday.png"),
  "Tomorrow": require("../../assets/thumbnails/Tomorrow.png"),

  // Physical Appearance
  "Dimple": require("../../assets/thumbnails/Dimple.png"),
  "Nose": require("../../assets/thumbnails/Nose.png"),
  "Long Hair": require("../../assets/thumbnails/LongHair.png"),
  "Straight Hair": require("../../assets/thumbnails/StraightHair.png"),
  "Tall": require("../../assets/thumbnails/Tall.png"),
  "Short": require("../../assets/thumbnails/Short.png"),  
  
  // SOGIESC
  "Anti-discrimination ordinance": require("../../assets/thumbnails/Anti-discriminationOrdinance.png"),
  "Bisexual": require("../../assets/thumbnails/Bisexual.png"),
  "Cisgender": require("../../assets/thumbnails/Cisgender.png"),
  "Feminine": require("../../assets/thumbnails/Feminine.png"),
  "Gay": require("../../assets/thumbnails/Gay.png"),
  "Genderqueer": require("../../assets/thumbnails/Genderqueer.png"),
  "Lesbian": require("../../assets/thumbnails/Lesbian.png"),
  "Masculine": require("../../assets/thumbnails/Masculine.png"),
  "Sexual Orientation": require("../../assets/thumbnails/SexualOrientation.png"),
  "SOGIESC": require("../../assets/thumbnails/SOGIESC.png"),
  "Transgender": require("../../assets/thumbnails/Transgender.png")
};

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("Alphabet");
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);

  const currentWords = words[selectedCategory] || [];
  const selectedWord = selectedWordIndex !== null ? currentWords[selectedWordIndex] : null;
  const currentModelSource = categoryAssets[selectedCategory];

  // Get Icon for Fallback
  const currentCategoryIcon = categories.find(c => c.key === selectedCategory)?.icon || "shapes-outline";

  useEffect(() => {
    // Preload Logic
    const assetsToLoad = Object.values(categoryAssets).filter(Boolean);
    if(assetsToLoad.length > 0) {
        const preloadModels = async () => {
            try { await Promise.all(assetsToLoad.map((m) => Asset.fromModule(m).downloadAsync())); } 
            catch (e) { console.log("Preload warning:", e); }
        };
        preloadModels();
    }
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (selectedWordIndex !== null) { setSelectedWordIndex(null); return true; }
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

  // --- RENDER FOCUS MODE ---
  if (selectedWordIndex !== null) {
    return (
      <WordFocus 
        word={selectedWord}
        category={selectedCategory}
        categoryIcon={currentCategoryIcon}
        modelSource={categoryAssets[selectedCategory] || null}
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

  // --- RENDER LIBRARY MENU ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Library</Text>
      </View>

      {/* Categories: "Story Style" Circles */}
      <View style={styles.categoryContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10 }}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.key;
            return (
              <TouchableOpacity 
                style={styles.storyItem} 
                onPress={() => setSelectedCategory(item.key)}
                activeOpacity={0.7}
              >
                {/* Circle Container */}
                <View style={[styles.storyCircle, isActive && styles.storyCircleActive]}>
                  <Ionicons 
                    name={item.icon} 
                    size={24} 
                    color={isActive ? "#FFF" : "#666"} 
                  />
                </View>
                
                {/* Label Below */}
                <Text style={[styles.storyText, isActive && styles.storyTextActive]}>
                  {item.key}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Word Grid - 2 Columns */}
      <FlatList 
        data={currentWords}
        keyExtractor={(item) => item}
        numColumns={2} // <--- CHANGED TO 2
        contentContainerStyle={{ padding: CONTAINER_PADDING }}
        ListEmptyComponent={
            <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#999'}}>No words in this category yet.</Text>
            </View>
        }
        renderItem={({ item, index }) => {
          // 1. Check if a thumbnail exists for this word/letter
          const thumbnailSource = modelThumbnails[item];

          return (
            <TouchableOpacity 
               style={styles.wordCard} 
               onPress={() => setSelectedWordIndex(index)}
            >
              <View style={styles.cardInner}>
                 {thumbnailSource ? (
                    // 2. IF THUMBNAIL EXISTS: Show the Image
                    <Image 
                      source={thumbnailSource} 
                      style={styles.thumbnailImage} 
                      resizeMode="contain" 
                    />
                 ) : (
                    // 3. FALLBACK: Show the old Icon/Letter circle
                    <View style={styles.iconFallback}>
                        {item.length < 5 ? (
                            <Text style={styles.wordLetter}>{item.charAt(0)}</Text>
                        ) : (
                            <Ionicons name={currentCategoryIcon} size={32} color="#E64C3C" />
                        )}
                    </View>
                 )}
              </View>
              
              <Text style={styles.wordLabel} numberOfLines={2}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  headerText: { fontSize: 28, fontWeight: "bold", color: "#333" },
  
categoryContainer: { 
    height: 100, // Taller to fit circle + text
    marginBottom: 10 
  },
  storyItem: { 
    alignItems: 'center', 
    marginRight: 16, 
    width: 70, // Fixed width ensures text wraps nicely if needed
  },
  storyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5', // Light gray inactive
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    // Optional: Add a subtle border
    borderWidth: 1,
    borderColor: '#EEEEEE'
  },
  storyCircleActive: {
    backgroundColor: '#E64C3C', // Your brand color
    borderColor: '#E64C3C',
    elevation: 4, // Shadow for active item
    shadowColor: "#E64C3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  storyText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  storyTextActive: {
    color: '#E64C3C',
    fontWeight: 'bold',
  },
  // --- UPDATED CARD STYLES (2 COLUMNS) ---
  wordCard: { 
    width: CARD_WIDTH, // Calculated width for 2 columns
    height: 140,       // Slightly taller for better spacing
    margin: CARD_MARGIN,
    backgroundColor: "#fff", 
    borderRadius: 20, 
    alignItems: "center", 
    justifyContent: "center", // Center align content vertically
    padding: 12,
    borderWidth: 1, 
    borderColor: "#F0F0F0", 
    elevation: 3,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: {width:0, height:4}
  },
  cardInner: { 
    marginBottom: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  thumbnailImage: {
    width: 90,       // Slightly larger to fill the card center
    height: 90,
    borderRadius: 10,
    marginTop: 5,
  },
  iconFallback: {
    width: 55, height: 55, borderRadius: 27.5, 
    backgroundColor: "#FFF0F0", 
    justifyContent: 'center', alignItems: 'center'
  },
  wordLetter: { fontSize: 24, fontWeight: "bold", color: "#E64C3C" },
  wordLabel: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#333", 
    textAlign: "center" // Center align text
  }
});