
'use client';

import React, { FC, useState, useEffect, useRef } from 'react';

interface WheelParticipant {
  userId: string;
  name: string;
  color: string;
}

interface WheelOfFortuneProps {
  participants: WheelParticipant[];
  winnerIndex: number | null;
  isSpinning: boolean; // Controlled by parent to start/indicate spinning phase
  onSpinEnd: () => void;
}

const WheelOfFortune: FC<WheelOfFortuneProps> = ({ participants, winnerIndex, isSpinning, onSpinEnd }) => {
  const numSegments = participants.length;
  const segmentAngle = numSegments > 0 ? 360 / numSegments : 360;
  const radius = 150;
  const center = 160;
  const wheelRef = useRef<SVGGElement>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isSpinning) {
      setIsAnimating(true);
      if (winnerIndex === null) {
        // Continuous spin until winner is known
        // This can be a CSS animation or a JS driven one
        // For simplicity, we'll use a target rotation far away to simulate spin
        // and rely on winnerIndex to stop it.
        // A proper continuous spin would use requestAnimationFrame.
        if (wheelRef.current) {
          wheelRef.current.style.transition = 'transform 10s cubic-bezier(0.25, 0.1, 0.25, 1)'; // Slow continuous spin
          setCurrentRotation(prev => prev + 360 * 5); // Spin a few times
        }
      } else if (winnerIndex !== null) {
        // Winner is known, spin to the winner
        const targetSegment = winnerIndex;
        // Calculate the angle to point the top of the wheel (e.g., a pointer at 12 o'clock / -90deg) to the middle of the winner's segment
        const winnerAngle = (targetSegment * segmentAngle) + (segmentAngle / 2);
        // Base rotation to align segment middle with pointer (assuming pointer is at -90deg or 270deg)
        // SVG rotation is clockwise. We want to point the segment *upwards*.
        // Middle of segment angle (winnerAngle) should be at 270 deg (top).
        // So, rotation = 270 - winnerAngle. Or, -(winnerAngle - 90) for CCW interpretation.
        // Let's adjust so 0 degree is at the top.
        // The "pointer" is considered to be at the top (positive Y-axis in user space before rotation, which is 270deg or -90deg in typical angle systems).
        // We want the middle of the winner's segment to align with this pointer.
        // Each segment's start angle is `i * segmentAngle`. Middle is `i * segmentAngle + segmentAngle / 2`.
        // Let this be `midAngle`. We want `currentRotation + midAngle` to point up (270 deg).
        // No, easier: targetRotation should make the winner's segment land at a fixed pointer (e.g. 12 o'clock).
        // Final rotation = (full_rotations * 360) - (winner_segment_mid_angle - pointer_offset_angle)
        // Pointer is at 270 degrees (top of the SVG circle).
        const baseOffsetAngle = -90; // Make segment 0 start at the top
        const targetRotationValue = 360 * 4 - (winnerAngle + baseOffsetAngle); // Spin 4 full times then land

        if (wheelRef.current) {
          wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.33, 1, 0.68, 1)'; // Ease-out spin
        }
        setCurrentRotation(targetRotationValue);

        // Call onSpinEnd after animation duration
        const animationDuration = 4000; // ms, should match CSS transition
        setTimeout(() => {
          setIsAnimating(false);
          onSpinEnd();
        }, animationDuration);
      }
    } else {
      // If !isSpinning (e.g. draw reset), reset wheel smoothly
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 1s ease-out';
      }
      setCurrentRotation(winnerIndex !== null ? currentRotation : 0); // Stay on winner or reset
      setIsAnimating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, winnerIndex]); // Removed onSpinEnd from deps as it's a stable callback


  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const toRadians = (angle: number) => (angle -90) * (Math.PI / 180); // Adjust for SVG arc starting from 3 o'clock
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);

    const start = {
      x: x + r * Math.cos(startRad),
      y: y + r * Math.sin(startRad)
    };
    const end = {
      x: x + r * Math.cos(endRad),
      y: y + r * Math.sin(endRad)
    };
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return [
      `M ${x} ${y}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z'
    ].join(' ');
  };

  const getTextCoordinates = (index: number, r: number) => {
    const angle = (index * segmentAngle + segmentAngle / 2) - 90; // Center text in segment, adjust for text rotation
    const radians = angle * (Math.PI / 180);
    const textRadius = r * 0.7; // Position text 70% out from center
    return {
      x: center + textRadius * Math.cos(radians),
      y: center + textRadius * Math.sin(radians),
      rotation: angle + 90 // Rotate text to be upright relative to segment
    };
  };


  if (numSegments === 0) {
    return (
      <div className="text-muted-foreground p-8 border rounded-md text-center">
        Add participants to see the wheel!
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg width={center * 2} height={center * 2} viewBox={`0 0 ${center * 2} ${center * 2}`} className="overflow-visible">
        {/* Pointer */}
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
          </filter>
        </defs>
        <polygon points={`${center-10},2 ${center+10},2 ${center},22`} fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="2" style={{filter: 'url(#shadow)'}} />

        <g ref={wheelRef} transform={`rotate(${currentRotation} ${center} ${center})`} style={{transformOrigin: `${center}px ${center}px`}}>
          {participants.map((participant, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            const { x: textX, y: textY, rotation: textRotation } = getTextCoordinates(index, radius);

            return (
              <g key={participant.userId}>
                <path
                  d={describeArc(center, center, radius, startAngle, endAngle)}
                  fill={participant.color || (index % 2 === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--muted))')}
                  stroke="hsl(var(--card-foreground))"
                  strokeWidth="1"
                />
                <text
                  x={textX}
                  y={textY}
                  transform={`rotate(${textRotation} ${textX} ${textY})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fill="hsl(var(--card-foreground))"
                  className="font-semibold pointer-events-none select-none"
                >
                  {participant.name.length > 15 ? participant.name.substring(0, 13) + '...' : participant.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {isAnimating && winnerIndex === null && (
         <div className="absolute inset-0 flex items-center justify-center bg-opacity-50">
            <p className="text-xl font-semibold text-primary animate-pulse p-2 rounded-md">Spinning...</p>
         </div>
      )}
    </div>
  );
};
export default WheelOfFortune;

