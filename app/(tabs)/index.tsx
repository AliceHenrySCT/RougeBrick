import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Game from '@/components/Game';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PlayTab() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [round, setRound] = useState(1);

  useEffect(() => {
    // Hide Android bottom nav bar and status bar for immersive gaming
    NavigationBar.setVisibilityAsync('hidden');
    StatusBar.setHidden(true, 'fade');
    
    // Load high score
    loadHighScore();
    
    return () => {
      // Restore UI when leaving
      NavigationBar.setVisibilityAsync('visible');
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const loadHighScore = async () => {
    try {
      const savedHighScore = await AsyncStorage.getItem('highScore');
      if (savedHighScore) {
        setHighScore(parseInt(savedHighScore));
      }
    } catch (error) {
      console.error('Error loading high score:', error);
    }
  };

  const saveHighScore = async (score: number) => {
    try {
      await AsyncStorage.setItem('highScore', score.toString());
      setHighScore(score);
    } catch (error) {
      console.error('Error saving high score:', error);
    }
  };

  const handleGameEnd = (finalScore: number, won: boolean) => {
    setCurrentScore(finalScore);
    
    if (finalScore > highScore) {
      saveHighScore(finalScore);
    }
    
    if (won) {
      // Auto-start next round after a brief delay
      setTimeout(() => {
        setRound(prev => prev + 1);
        setGameState('playing');
      }, 2000);
    } else {
      setGameState('gameOver');
    }
  };

  const startNewGame = () => {
    setCurrentScore(0);
    setRound(1);
    setGameState('playing');
  };

  const backToMenu = () => {
    setGameState('menu');
    setRound(1);
  };

  if (gameState === 'playing') {
    return (
      <Game 
        onGameEnd={handleGameEnd}
        round={round}
        currentScore={currentScore}
      />
    );
  }

  if (gameState === 'gameOver') {
    return (
      <View style={styles.menuContainer}>
        <Text style={styles.title}>Game Over!</Text>
        <Text style={styles.scoreText}>Final Score: {currentScore}</Text>
        <Text style={styles.roundText}>Reached Round: {round}</Text>
        {currentScore === highScore && (
          <Text style={styles.newHighScore}>🎉 New High Score! 🎉</Text>
        )}
        <Text style={styles.highScoreText}>High Score: {highScore}</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={startNewGame}>
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={backToMenu}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Main Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Brick Breaker</Text>
      <Text style={styles.subtitle}>Break all bricks to advance rounds!</Text>
      <Text style={styles.highScoreText}>High Score: {highScore}</Text>
      
      <TouchableOpacity style={styles.button} onPress={startNewGame}>
        <Text style={styles.buttonText}>Start Game</Text>
      </TouchableOpacity>
      
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>• Drag to move paddle</Text>
        <Text style={styles.instructionText}>• Break all bricks to win</Text>
        <Text style={styles.instructionText}>• Each round gets harder</Text>
        <Text style={styles.instructionText}>• Try for the high score!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 48,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
  },
  roundText: {
    fontSize: 20,
    color: '#ccc',
    marginBottom: 10,
    fontFamily: 'Inter-Regular',
  },
  newHighScore: {
    fontSize: 20,
    color: '#FFD700',
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  highScoreText: {
    fontSize: 18,
    color: '#6200EE',
    marginBottom: 30,
    fontFamily: 'Inter-Bold',
  },
  buttonContainer: {
    gap: 15,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: '#6200EE',
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  secondaryButtonText: {
    color: '#6200EE',
  },
  instructions: {
    marginTop: 40,
    alignItems: 'flex-start',
  },
  instructionText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
});