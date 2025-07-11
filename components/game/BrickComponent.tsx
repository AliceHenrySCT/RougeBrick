import React from 'react';
import { RoundedRect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { BrickInterface } from '../../types';
import { BRICK_WIDTH, BRICK_HEIGHT, TOTAL_BRICKS, BRICK_ROW_LENGTH } from '../../constants';

// Helper function to calculate row color gradient
const getRowColor = (rowIndex: number, totalRows: number) => {
  'worklet';
  const progress = rowIndex / (totalRows - 1);
  // Interpolate from bright purple (200, 0, 200) to blue (0, 0, 255)
  const red = Math.round(200 * (1 - progress));
  const green = 0;
  const blue = Math.round(200 + (55 * progress));
  return `rgb(${red}, ${green}, ${blue})`;
};

interface BrickProps {
  idx: number;
  brick: BrickInterface;
}

export const Brick: React.FC<BrickProps> = ({ idx, brick }) => {
  // Calculate row number for color gradient
  const row = Math.floor(idx / BRICK_ROW_LENGTH);
  const totalRows = Math.ceil(TOTAL_BRICKS / BRICK_ROW_LENGTH);
  
  const color = useDerivedValue(
    () => (brick.canCollide.value ? getRowColor(row, totalRows) : 'transparent'),
    [brick.canCollide]
  );
  const borderColor = useDerivedValue(
    () => (brick.canCollide.value ? '#1a1a1a' : 'transparent'),
    [brick.canCollide]
  );
  
  const brickMainX = useDerivedValue(() => brick.x.value + 1, [brick.x]);
  const brickMainY = useDerivedValue(() => brick.y.value + 1, [brick.y]);
  const brickMainWidth = useDerivedValue(() => brick.width - 2, []);
  const brickMainHeight = useDerivedValue(() => brick.height - 2, []);
  
  return (
    <>
      {/* Border layer - slightly larger dark rectangle */}
      <RoundedRect
        key={`${idx}-border`}
        x={brick.x}
        y={brick.y}
        width={BRICK_WIDTH}
        height={BRICK_HEIGHT}
        color={borderColor}
        r={4}
      />
      {/* Main brick - slightly smaller to show border */}
      <RoundedRect
        key={idx}
        x={brickMainX}
        y={brickMainY}
        width={brickMainWidth}
        height={brickMainHeight}
        color={color}
        r={3}
      />
    </>
  );
};