
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
  isSpinning: boolean;
  onSpinEnd: () => void;
}

const WheelOfFortune: FC<WheelOfFortuneProps> = ({ participants, winnerIndex, isSpinning, onSpinEnd }) => {
  // Ensure participants is always an array
  const validParticipants = Array.isArray(participants) ? participants : [];

  const numSegments = validParticipants.length;
  const segmentAngle = numSegments > 0 ? 360 / numSegments : 360;
  const radius = 150;
  const center = 160; // SVG canvas is 320x320, so center is (160,160)
  const wheelRef = useRef<SVGGElement>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false); // Local animation state

  // Helper function to calculate the target rotation for landing on the winner
  const calculateLandingRotation = (currentAngle: number, winnerIdx: number): number => {
    const numSpins = 4 + Math.floor(Math.random() * 3); // 4 to 6 full spins for effect

    // Angle of the middle of the winner's segment (0=top, CW positive)
    const winnerMidPointAngle = (winnerIdx * segmentAngle) + (segmentAngle / 2);
    
    // Target rotation: spin N times and then align winnerMidPointAngle to 0 (the pointer)
    // Since rotation is CW, we rotate by -winnerMidPointAngle to bring it to the top.
    let targetRotation = (numSpins * 360) - winnerMidPointAngle;

    // Ensure the wheel always spins forward by at least one full rotation plus the adjustment
    // This makes sure targetRotation is always greater than currentAngle + some buffer
    const minSpinsToEnsureForwardMovement = 360; // Must spin at least this much more than current
    while (targetRotation < currentAngle + minSpinsToEnsureForwardMovement) {
      targetRotation += 360;
    }
    
    return targetRotation;
  };

  useEffect(() => {
    const wheelElement = wheelRef.current;
    if (!wheelElement) return;

    if (isSpinning) {
      setIsAnimating(true);
      if (winnerIndex === null) {
        // Initial "continuous" spin (actually a long, timed spin)
        // For a true indefinite spin, CSS @keyframes would be better.
        // This phase is usually short before winnerIndex is set.
        const initialSpinDuration = 6000 + Math.random() * 4000; // 6-10 seconds
        wheelElement.style.transition = `transform ${initialSpinDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        setCurrentRotation(prev => prev + 360 * (8 + Math.floor(Math.random() * 5))); // Spin many times
      } else {
        // Winner is known, animate to the winner
        const targetRotation = calculateLandingRotation(currentRotation, winnerIndex);
        const animationDuration = 4000; // 4 seconds to land

        wheelElement.style.transition = `transform ${animationDuration}ms cubic-bezier(0.33, 1, 0.68, 1)`; // Ease-out effect
        setCurrentRotation(targetRotation);

        setTimeout(() => {
          setIsAnimating(false);
          onSpinEnd();
        }, animationDuration);
      }
    } else {
      // Not spinning (e.g., draw reset or initial state)
      setIsAnimating(false);
      if (winnerIndex === null) { // If explicitly reset (no winner)
        wheelElement.style.transition = 'transform 0.5s ease-out';
        setCurrentRotation(0); // Reset to initial position
      }
      // If winnerIndex is not null and not spinning, it means we've landed.
      // currentRotation should hold the final landing angle.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, winnerIndex, segmentAngle]); // Added segmentAngle as it's used in calculateLandingRotation indirectly

  // Describes an arc for an SVG path: (cx, cy, radius, startAngle, endAngle)
  // Angles are 0=top, positive=clockwise
  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const toRadians = (angle: number) => angle * (Math.PI / 180);
    
    const startRad = toRadians(startAngle - 90); // Convert "0=top, CW" to "0=right, CCW (math)" for cos/sin
    const endRad = toRadians(endAngle - 90);

    const start = {
      x: x + r * Math.cos(startRad),
      y: y + r * Math.sin(startRad)
    };
    const end = {
      x: x + r * Math.cos(endRad),
      y: y + r * Math.sin(endRad)
    };
    
    const arcSweep = endAngle - startAngle <= 180 ? 0 : 1; // large-arc-flag

    return [
      `M ${x} ${y}`, // Move to center
      `L ${start.x} ${start.y}`, // Line to start of arc
      `A ${r} ${r} 0 ${arcSweep} 1 ${end.x} ${end.y}`, // Arc to end (1 for sweep-flag = CW)
      'Z' // Close path (back to center)
    ].join(' ');
  };

  const getTextCoordinates = (index: number, r: number) => {
    // Angle for text positioning: middle of the segment, in "0=top, CW" system
    const midSegmentAngleLocal = index * segmentAngle + segmentAngle / 2;
    
    // Convert to "0=right, CCW (math)" for Math.cos/sin
    const mathAngleRad = (midSegmentAngleLocal - 90) * (Math.PI / 180);
    
    const textRadius = r * 0.65; // Position text 65% out from center
    const x = center + textRadius * Math.cos(mathAngleRad);
    const y = center + textRadius * Math.sin(mathAngleRad);
    
    // Text rotation: align with segment radial line.
    // midSegmentAngleLocal is already the orientation of the segment's radial bisector from top.
    const rotation = midSegmentAngleLocal;
    
    return { x, y, rotation };
  };

  if (numSegments === 0 && !isSpinning) {
    return (
      <div className="text-muted-foreground p-8 border rounded-md text-center min-h-[340px] flex items-center justify-center">
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
            <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.2)" />
          </filter>
        </defs>
        <polygon 
          points={`${center-8},2 ${center+8},2 ${center},20`} 
          fill="hsl(var(--primary))" 
          stroke="hsl(var(--primary-foreground))" 
          strokeWidth="1.5" 
          style={{filter: 'url(#shadow)'}} 
        />

        <g 
          ref={wheelRef} 
          style={{ 
            transform: `rotate(${currentRotation}deg)`, 
            transformOrigin: `${center}px ${center}px`,
            // CSS transition is set in useEffect via wheelRef.current.style.transition
          }}
        >
          {participants.map((participant, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            // Ensure endAngle doesn't slightly overlap due to floating point issues for the last segment
            const correctedEndAngle = (index === numSegments - 1 && numSegments > 1) ? 360.0 : endAngle;


            const { x: textX, y: textY, rotation: textRotation } = getTextCoordinates(index, radius);

            return (
              <g key={participant.userId}>
                <path
                  d={describeArc(center, center, radius, startAngle, correctedEndAngle)}
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
                  {participant.name.length > 12 ? participant.name.substring(0, 10) + '...' : participant.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {isAnimating && winnerIndex === null && (
         <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
            <p className="text-lg font-semibold text-primary animate-pulse p-2 rounded-md bg-background/80 shadow-md">Spinning...</p>
         </div>
      )}
    </div>
  );
};
export default WheelOfFortune;
