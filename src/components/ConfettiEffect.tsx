'use client';

import React, { useState, useEffect } from 'react';
import ReactConfetti from 'react-confetti';

export default function ConfettiEffect() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    if (typeof window !== 'undefined') {
      handleResize(); // Initial size
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  if (windowSize.width === 0) {
    return null; // Don't render until window size is known
  }

  return (
    <ReactConfetti
      width={windowSize.width}
      height={windowSize.height}
      recycle={false}
      numberOfPieces={400}
      gravity={0.15}
      initialVelocityY={{min: -20, max: -10}}
      initialVelocityX={{min: -15, max: 15}}
      tweenDuration={10000}
      onConfettiComplete={(confetti) => {
        if (confetti) confetti.reset(); // Optional: Reset if needed for specific logic
      }}
    />
  );
}
