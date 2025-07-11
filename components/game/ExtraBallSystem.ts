import { SharedValue } from 'react-native-reanimated';
import { CircleInterface, PaddleInterface } from '../../types';
import { RADIUS, MAX_SPEED } from '../../constants';

export const createExtraBallSpawner = (
  circleObject: CircleInterface,
  rectangleObject: PaddleInterface,
  allExtraBalls: CircleInterface[],
  extraBallPowerUps: SharedValue<number>,
  hasUsedExtraBalls: SharedValue<boolean>,
  extraBallSpawnTime: SharedValue<number>
) => {
  const spawnExtraBalls = () => {
    'worklet';
    
    // Check if we have power-ups and haven't used them yet
    if (extraBallPowerUps.value <= 0 || hasUsedExtraBalls.value) {
      return;
    }
    
    // Mark as used
    hasUsedExtraBalls.value = true;
    
    // Record spawn time for delayed velocity copying
    extraBallSpawnTime.value = Date.now();
    
    // Spawn the number of extra balls we have power-ups for (max 5)
    const ballsToSpawn = Math.min(extraBallPowerUps.value, 5);
    
    for (let i = 0; i < ballsToSpawn; i++) {
      const extraBall = allExtraBalls[i];
      
      // Position near paddle to trigger immediate collision
      const offsetX = (i % 2 === 0 ? 1 : -1) * RADIUS * (Math.floor(i / 2) + 1);
      const paddleY = rectangleObject.y.value;
      
      extraBall.x.value = rectangleObject.x.value + (rectangleObject.width / 2) + offsetX;
      extraBall.y.value = paddleY - RADIUS + 2; // Position just touching the paddle top
      
      // Set initial velocity - will be modified by paddle collision
      extraBall.vx = (Math.random() - 0.5) * MAX_SPEED * 0.5;
      extraBall.vy = Math.abs(circleObject.vy) * 0.8; // Downward velocity to hit paddle
      
      // Copy acceleration
      extraBall.ax = circleObject.ax;
      extraBall.ay = circleObject.ay;
    }
  };

  const copyVelocityToExtraBalls = () => {
    'worklet';
    
    // Calculate main ball's speed and direction
    const mainSpeed = Math.sqrt(circleObject.vx * circleObject.vx + circleObject.vy * circleObject.vy);
    const mainAngle = Math.atan2(circleObject.vy, circleObject.vx);
    
    // Copy velocity with random angle variations while maintaining speed
    for (const extraBall of allExtraBalls) {
      if (extraBall.x.value > -50) { // Only copy to visible/active extra balls
        // Add random angle variation (±30 degrees)
        const angleVariation = (Math.random() - 0.5) * (Math.PI / 1.5); // ±60 degrees in radians
        const newAngle = mainAngle + angleVariation;
        
        // Apply the same speed but with the new angle
        extraBall.vx = Math.cos(newAngle) * mainSpeed;
        extraBall.vy = Math.sin(newAngle) * mainSpeed;
        extraBall.ax = circleObject.ax;
        extraBall.ay = circleObject.ay;
      }
    }
  };

  return {
    spawnExtraBalls,
    copyVelocityToExtraBalls,
  };
};