// home.js
import React from 'react';
import { View, Text, Button } from 'react-native';

export default function Home({ navigation }) {
  return (
    <View style={{ flex:1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome to the Home Screen</Text>
      <Button
        title="Go to Library"
        onPress={() => navigation.navigate('Library')}
      />
    </View>
  );
}
