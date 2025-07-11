import { CircleInterface, PaddleInterface, BrickInterface } from '../../types';
import { createBouncingExample } from '../../logic';
import { SharedValue } from 'react-native-reanimated';

export const createGameResetFunctions = (
  circleObject: CircleInterface,
  rectangleObject: PaddleInterface,
  allExtraBalls: CircleInterface[],
  bricks: BrickInterface[],
  adjustedPaddleMiddle: number,
  brickCount: SharedValue<number>,
  gameEnded: SharedValue<boolean>,
  extraBallSpawnTime: SharedValue<number>,
  shouldCopyVelocity: SharedValue<boolean>
) => {
  const resetGame = () => {
    'worklet';
    rectangleObject.x.value = adjustedPaddleMiddle;
    createBouncingExample(circleObject);
    
    // Reset extra ball timing flags
    extraBallSpawnTime.value = 0;
    shouldCopyVelocity.value = false;
    
    // Reset all extra balls
    for (const extraBall of allExtraBalls) {
      extraBall.x.value = -1000;
      extraBall.y.value = -1000;
      extraBall.vx = 0;
      extraBall.vy = 0;
      extraBall.ax = 0;
      extraBall.ay = 0;
    }
    
    for (const brick of bricks) {
      brick.canCollide.value = true;
    }
    brickCount.value = 0;
    gameEnded.value = false;
  };

  const respawnBall = () => {
    'worklet';
    rectangleObject.x.value = adjustedPaddleMiddle;
    createBouncingExample(circleObject);
    
    // Reset extra ball timing flags
    extraBallSpawnTime.value = 0;
    shouldCopyVelocity.value = false;
    
    // Reset all extra balls
    for (const extraBall of allExtraBalls) {
      extraBall.x.value = -1000;
      extraBall.y.value = -1000;
      extraBall.vx = 0;
      extraBall.vy = 0;
      extraBall.ax = 0;
      extraBall.ay = 0;
    }
  };

  return {
    resetGame,
    respawnBall,
  };
};