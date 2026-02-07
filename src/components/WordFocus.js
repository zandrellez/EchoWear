import React, { useRef, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ModelViewer from "./ModelViewer";
import { useTextToSpeech } from "./useTextToSpeech"; 

export default function WordFocus({ 
  word, category, modelSource, animationName, 
  onBack, onNext, onPrev, canNext, canPrev, 
  wordList, currentIndex, onSelectWordFromModal 
}) {
  const modelRef = useRef();
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const { speak, stop } = useTextToSpeech();

  useEffect(() => {
    if (word) { stop(); speak(word); }
    return () => stop();
  }, [word]);

  return (
    <View style={styles.container}>
      {/* 1. Background Model Area */}
      <View style={styles.modelArea}>
         <Text style={styles.watermark}>{word?.charAt(0)}</Text>
         <ModelViewer 
            ref={modelRef}
            source={modelSource}
            animationName={animationName}
            animationSpeed={animationSpeed}
         />
      </View>

      {/* 2. Header */}
      <View style={styles.header}>
         <View style={styles.breadcrumbs}>
            <TouchableOpacity onPress={onBack}><Text style={styles.breadLink}>Library</Text></TouchableOpacity>
            <Ionicons name="chevron-forward" size={12} color="#E64C3C" />
            <Text style={styles.breadLink}>{category}</Text>
         </View>
         <TouchableOpacity onPress={onBack} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#E64C3C" />
         </TouchableOpacity>
      </View>

      {/* 3. Glass Controls (Speeds + Play) */}
      <View style={styles.glassControls}>
        <View style={styles.glassPill}>
           {[0.25, 0.5, 1, 2].map((speed) => (
             <TouchableOpacity key={speed} onPress={() => setAnimationSpeed(speed)}>
                <Text style={[styles.speedText, animationSpeed === speed && styles.activeSpeed]}>{speed}x</Text>
             </TouchableOpacity>
           ))}
        </View>
      </View>

      {/* 4. Bottom Card */}
      <View style={styles.bottomCard}>
         <View style={styles.infoRow}>
            {/* FIX: Removed "as in..." text */}
            <Text style={styles.mainTitle}>{word}</Text>
            <TouchableOpacity onPress={() => setShowModal(true)}>
               <Ionicons name="book-outline" size={24} color="#666" />
            </TouchableOpacity>
         </View>

         <View style={styles.navRow}>
            {/* PREV BUTTON (Arrow Left) */}
            <TouchableOpacity 
               onPress={onPrev} 
               disabled={!canPrev} 
               style={[styles.navBtn, !canPrev && {opacity:0.3}]}
            >
               <Ionicons name="arrow-back" size={20} color="#333" />
               <Text style={styles.navText}>Prev</Text>
            </TouchableOpacity>
            
            {/* REPLAY BUTTON (Replaces Letter Badge) */}
            <TouchableOpacity 
               style={styles.replayCircle}
               onPress={() => modelRef.current?.replay()}
            >
               <Ionicons name="refresh" size={26} color="#FFF" />
            </TouchableOpacity>

            {/* NEXT BUTTON (Arrow Right) */}
            <TouchableOpacity 
               onPress={onNext} 
               disabled={!canNext} 
               style={[styles.navBtn, !canNext && {opacity:0.3}]}
            >
               <Text style={styles.navText}>Next</Text>
               <Ionicons name="arrow-forward" size={20} color="#333" />
            </TouchableOpacity>
         </View>
      </View>

      {/* 5. Modal */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Quick Select</Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                     <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
               </View>
               <FlatList 
                  data={wordList} numColumns={4} keyExtractor={(item) => item}
                  renderItem={({item, index}) => (
                     <TouchableOpacity style={[styles.gridItem, index === currentIndex && styles.activeGridItem]}
                        onPress={() => { onSelectWordFromModal(index); setShowModal(false); }}>
                        <Text style={[styles.gridText, index === currentIndex && {color:'#FFF'}]}>{item}</Text>
                     </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3CCBC' }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, zIndex: 10 },
  breadcrumbs: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  breadLink: { color: '#E64C3C', fontWeight: '600', fontSize: 16 },
  
  modelArea: { 
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    zIndex: 0 
  },
  watermark: { position: 'absolute', alignSelf:'center', fontSize: 200, fontWeight: 'bold', color: '#FFF', opacity: 0.3, top: '15%' },

  glassControls: { position: 'absolute', bottom: 180, width: '100%', alignItems: 'center', zIndex: 20 },
  glassPill: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 30, padding: 10, alignItems: 'center', gap: 20 },
  speedText: { fontWeight: '600', color: '#555' },
  activeSpeed: { color: '#E64C3C', fontWeight: 'bold' },

  bottomCard: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.1, elevation: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 50, padding: 5 },
  navBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 5 },
  navText: { fontWeight: '600', color: '#333' },
  
  // NEW REPLAY BUTTON STYLE
  replayCircle: { 
     width: 50, height: 50, borderRadius: 25, 
     backgroundColor: '#E64C3C', 
     justifyContent: 'center', alignItems: 'center',
     shadowColor: '#E64C3C', shadowOpacity: 0.3, elevation: 5,
     marginTop: 0 // Pops out slightly from the row
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '50%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  gridItem: { flex: 1, margin: 5, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' },
  activeGridItem: { backgroundColor: '#E64C3C' },
  gridText: { fontWeight: 'bold' }
});