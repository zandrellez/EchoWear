import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  Platform,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";

const STATUSBAR_HEIGHT =
  Platform.OS === "ios" ? Constants.statusBarHeight : StatusBar.currentHeight || 0;

// Adjust these to match your actual header and bottom tab height
const HEADER_HEIGHT = 60;
const BOTTOM_TAB_HEIGHT = 60;

export default function Home() {
  const [isTyping, setIsTyping] = useState(false);
  const [text, setText] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsTyping(false);
  };

  // Track keyboard visibility
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View style={{ flex: 1 }}>
          {/* Header with Logo */}
          <View style={styles.header}>
            <Image
              source={require("../assets/echowear.png")}
              style={styles.headerImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: STATUSBAR_HEIGHT,
  },
  header: {
    height: 60,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 3,
  },
  headerImage: {
    width: 160,
    height: 45,
  },
});
