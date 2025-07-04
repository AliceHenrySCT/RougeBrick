import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Game from './components/Game';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

export default function App() {
  useEffect(() => {
    // hide Android bottom nav bar
    NavigationBar.setVisibilityAsync('hidden');
    // also go full-screen by hiding the status bar
    StatusBar.setHidden(true, 'fade');
  }, []);
  
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <View style={styles.menuContainer}>
        <Text style={styles.title}>Brick Breaker</Text>
        <TouchableOpacity style={styles.button} onPress={() => setStarted(true)}>
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <Game onQuit={() => setStarted(false)} />;
}

const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    color: '#fff',
    marginBottom: 40,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: '#6200EE',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
  },
});