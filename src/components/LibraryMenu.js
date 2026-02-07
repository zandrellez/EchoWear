import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// Helper to get icons/images (Replace returns with require(...) if you have real images)
const getCategoryIcon = (key) => {
  switch (key) {
    // case "Alphabet": return require("../../assets/images/alphabet.png");
    default: return null; // Returns null to force fallback to Ionicons
  }
};

export default function LibraryMenu({ 
  categories, 
  selectedCategory, 
  onSelectCategory, 
  words, 
  onSelectWord 
}) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerSubtitle}>Select a category to start learning</Text>
      </View>

      {/* Categories (Horizontal Scroll) */}
      <View style={styles.categorySection}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.key;
            const iconSource = getCategoryIcon(item.key);

            return (
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => onSelectCategory(item.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, isActive && styles.activeIconCircle]}>
                  {iconSource ? (
                    <Image source={iconSource} style={styles.iconImage} />
                  ) : (
                    <Ionicons 
                      name={item.icon} 
                      size={24} 
                      color={isActive ? "#E64C3C" : "#888"} 
                    />
                  )}
                </View>
                <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                  {item.key}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Word Grid */}
      <View style={styles.gridSection}>
        <View style={styles.gridHeader}>
             <Text style={styles.gridTitle}>{selectedCategory}</Text>
             <Text style={styles.gridCount}>{words.length} items</Text>
        </View>
        
        <FlatList
          data={words}
          keyExtractor={(item) => item}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => onSelectWord(index)}
              activeOpacity={0.6}
            >
              <View style={styles.cardInner}>
                 <Text style={styles.cardLetter}>{item.charAt(0)}</Text>
              </View>
              <Text style={styles.cardText} numberOfLines={1}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
  headerTitle: { fontSize: 32, fontWeight: "800", color: "#333" },
  headerSubtitle: { fontSize: 14, color: "#888", marginTop: 4 },
  
  // Category Styles
  categorySection: { height: 110, marginBottom: 5 },
  categoryItem: { alignItems: "center", marginRight: 20, width: 70 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#F5F5F5",
    justifyContent: "center", alignItems: "center",
    marginBottom: 8,
    borderWidth: 2, borderColor: "transparent"
  },
  activeIconCircle: { borderColor: "#E64C3C", backgroundColor: "#FFF0F0" },
  iconImage: { width: "100%", height: "100%", borderRadius: 32 },
  categoryText: { fontSize: 12, color: "#888", textAlign: "center", fontWeight: "500" },
  activeCategoryText: { color: "#E64C3C", fontWeight: "bold" },

  // Grid Styles
  gridSection: { flex: 1, backgroundColor: "#FAFAFA", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 15, paddingTop: 20 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 10},
  gridTitle: { fontSize: 18, fontWeight: 'bold', color: '#333'},
  gridCount: { fontSize: 12, color: '#999'},
  
  card: { flex: 1, margin: 6, height: 100, backgroundColor: "#FFF", borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF5F5", justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardLetter: { fontSize: 18, fontWeight: "bold", color: "#E64C3C" },
  cardText: { fontSize: 13, fontWeight: "600", color: "#444" }
});