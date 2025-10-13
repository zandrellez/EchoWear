import 'react-native-gesture-handler';
import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Home from './src/screens/Home';
import Library from './src/screens/Library';

const Tab = createBottomTabNavigator();

export const HEADER_HEIGHT = 60;
export const TAB_HEIGHT = 70;
const { height } = Dimensions.get('window');
const availableHeight = height - HEADER_HEIGHT - TAB_HEIGHT;

export const cardHeights = {
  card1: availableHeight * 0.2,
  card2: availableHeight * 0.4,
  card3: availableHeight * 0.4,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <MyTabBar {...props} />}
        >
          <Tab.Screen name="Home" component={Home} />
          <Tab.Screen name="Library" component={Library} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function MyTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const iconName =
          route.name === 'Home'
            ? isFocused
              ? 'home'
              : 'home-outline'
            : isFocused
            ? 'library'
            : 'library-outline';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconWrapper,
                isFocused && styles.activeBackground,
              ]}
            >
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? '#E64C3C' : '#A8A8A8'}
              />
            </View>
            <Text
              style={[
                styles.label,
                { 
                  color: isFocused ? '#E64C3C' : '#A8A8A8',
                  fontWeight: isFocused ? 'bold' : 'normal',
                }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    height: TAB_HEIGHT,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 5,
    elevation: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 60,
    height: 30,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBackground: {
    backgroundColor: '#FDECEA',
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
});