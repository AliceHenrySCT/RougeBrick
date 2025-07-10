import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Game from '@/components/Game';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTabVisibility } from './_layout';
import { Zap, Shield, Circle } from 'lucide-react-native';

type PowerUp = 'speed' | 'shield' | 'extraBall' | null;

export default function PlayTab() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [round, setRound] = useState(1);
  const [lives, setLives] = useState(3);
  const [selectedPowerUp, setSelectedPowerUp] = useState<PowerUp>(null);
  const [extraBalls, setExtraBalls] = useState(0);
  const { setTabsVisible } = useTabVisibility();

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
      setGameState('roundComplete');
    } else {
      setGameState('gameOver');
    }
  };

  const startNewGame = () => {
    setCurrentScore(0);
    setRound(1);
    setLives(3);
    setExtraBalls(0);
    setGameState('playing');
  };

  const startNextRound = () => {
    setSelectedPowerUp(null); // Reset power-up selection
    setRound(prev => prev + 1);
    
    // Apply power-up effects
    if (selectedPowerUp === 'shield') {
      setLives(prev => prev + 1); // Extra life power-up
    } else if (selectedPowerUp === 'extraBall') {
      setExtraBalls(prev => Math.min(prev + 1, 9)); // Extra ball power-up (cap at 9 for 10 total)
    }
    
    setGameState('playing');
  };

  const backToMenu = () => {
    setGameState('menu');
    setRound(1);
    setLives(3);
    setExtraBalls(0);
  };

  const handleLivesChange = (newLives: number) => {
    setLives(newLives);
  };

  const handleExtraBallsChange = (newExtraBalls: number) => {
    setExtraBalls(newExtraBalls);
  };

  if (gameState === 'playing') {
    return (
      <Game 
        onGameEnd={handleGameEnd}
        round={round}
        currentScore={currentScore}
        onTabVisibilityChange={setTabsVisible}
        lives={lives}
        onLivesChange={handleLivesChange}
        extraBalls={extraBalls}
        onExtraBallsChange={handleExtraBallsChange}
      />
    );
  }

  if (gameState === 'roundComplete') {
    const powerUps = [
      {
        id: 'speed' as const,
        name: 'Speed Boost',
        description: 'Faster ball movement',
        icon: Zap,
        color: '#FFD700',
      },
      {
        id: 'shield' as const,
        name: 'Extra Life',
        description: 'One free miss',
        icon: Shield,
        color: '#00FF00',
      },
      {
        id: 'extraBall' as const,
        name: 'Extra Ball',
        description: 'Spawn additional ball',
        icon: Circle,
        color: '#FF6B6B',
      },
    ];

    return (
      <View style={styles.menuContainer}>
        <Text style={styles.title}>Round Complete!</Text>
        <Text style={styles.scoreText}>Score: {currentScore}</Text>
        <Text style={styles.roundText}>Round {round} Complete</Text>
        {currentScore === highScore && (
          <Text style={styles.newHighScore}>New High Score!</Text>
        )}
        
        <View style={styles.powerUpSection}>
          <Text style={styles.powerUpTitle}>Choose Your Power-Up</Text>
          {extraBalls > 0 && (
            <Text style={styles.extraBallsInfo}>
              Extra Balls: {extraBalls} (Total: {extraBalls + 1})
            </Text>
          )}
          <View style={styles.powerUpContainer}>
            {powerUps.map((powerUp) => {
              const IconComponent = powerUp.icon;
              const isSelected = selectedPowerUp === powerUp.id;
              
              return (
                <TouchableOpacity
                  key={powerUp.id}
                  style={[
                    styles.powerUpBox,
                    isSelected && styles.powerUpBoxSelected,
                    { borderColor: powerUp.color }
                  ]}
                  onPress={() => setSelectedPowerUp(powerUp.id)}
                >
                  <IconComponent 
                    size={32} 
                    color={isSelected ? powerUp.color : '#666'} 
                  />
                  <Text style={[
                    styles.powerUpName,
                    isSelected && { color: powerUp.color }
                  ]}>
                    {powerUp.name}
                  </Text>
                  <Text style={styles.powerUpDescription}>
                    {powerUp.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        <TouchableOpacity 
          style={[
            styles.button,
            !selectedPowerUp && styles.buttonDisabled
          ]} 
          onPress={startNextRound}
          disabled={!selectedPowerUp}
        >
          <Text style={[
            styles.buttonText,
            !selectedPowerUp && styles.buttonTextDisabled
          ]}>
            Next Round
          </Text>
        </TouchableOpacity>
      </View>
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
  powerUpSection: {
    width: '100%',
    marginVertical: 30,
  },
  powerUpTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  powerUpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 10,
  },
  powerUpBox: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    padding: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  powerUpBoxSelected: {
    backgroundColor: '#2a2a2a',
    transform: [{ scale: 1.05 }],
  },
  powerUpName: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  powerUpDescription: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 14,
  },
  buttonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#666',
  },
  extraBallsInfo: {
    fontSize: 16,
    color: '#FFD700',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 15,
  },
});