import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Play, Trophy, Settings } from 'lucide-react-native';

export default function TabLayout() {
  const [tabBarVisible, setTabBarVisible] = useState(true);

  // Listen for tab visibility changes from child components
  useEffect(() => {
    // This will be controlled by the Game component
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#333',
          display: tabBarVisible ? 'flex' : 'none',
        },
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: '#666',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Play',
          tabBarIcon: ({ size, color }) => (
            <Play size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Allow navigation to this tab to control tab visibility
          },
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Scores',
          tabBarIcon: ({ size, color }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}