
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter,
  CardHeader, CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  fairWinnerSelection,
  type FairWinnerSelectionInput,
  type FairWinnerSelectionOutput
} from '@/ai/flows/fair-winner-selection';
import ConfettiEffect from '@/components/ConfettiEffect';
import {
  QrCode, UsersRound, UserPlus, Trophy, PlayCircle,
  Loader2, AlertTriangle, PartyPopper
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WheelOfFortune from '@/components/WheelOfFortune';

interface Participant {
  userId: string;
  name: string;
  joinTime: Date;
  color: string;
}

interface DrawClientProps {
  drawId: string;
}

export default function DrawClient({ drawId }: DrawClientProps) {
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [winner, setWinner] = useState<FairWinnerSelectionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false); // General loading for AI call
  const [error, setError] = useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false); // Specifically for wheel animation
  const [wheelWinnerIndex, setWheelWinnerIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const participantColors = [
    '#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD',
    '#FF69B4', '#00CED1', '#FFA07A', '#FFC0CB', '#ADD8E6',
    '#90EE90', '#F0E68C', '#E6E6FA', '#FFB6C1', '#AFEEEE'
  ];


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedDescription = localStorage.getItem(`drawDescription-${drawId}`);
      setDescription(storedDescription || 'Welcome to the draw!');
      setQrCodeValue(window.location.href);
    }
  }, [drawId]);

  const handleAddParticipant = useCallback(() => {
    if (newParticipantName.trim() === '') {
      toast({ title: 'Error', description: 'Participant name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (participants.some(p => p.name.toLowerCase() === newParticipantName.trim().toLowerCase())) {
      toast({ title: 'Error', description: 'Participant with this name already exists.', variant: 'destructive' });
      return;
    }
    const assignedColor = participantColors[participants.length % participantColors.length];
    const newParticipant: Participant = {
      userId: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: newParticipantName.trim(),
      joinTime: new Date(),
      color: assignedColor,
    };
    setParticipants(prev => [...prev, newParticipant]);
    setNewParticipantName('');
    toast({ title: 'Participant Added', description: `${newParticipant.name} has joined the draw!` });
  }, [newParticipantName, participants, toast, participantColors]);

  const handleSelectWinner = async () => {
    if (participants.length < 1) {
      toast({ title: 'Error', description: 'Add at least one participant to start the draw.', variant: 'destructive' });
      return;
    }

    setIsLoading(true); // AI call is loading
    setIsSpinning(true); // Wheel should start spinning
    setError(null);
    setWinner(null);
    setShowConfetti(false);
    setWheelWinnerIndex(null); // Ensure wheel starts fresh if re-spinning

    const aiInput: FairWinnerSelectionInput = {
      participants: participants.map(p => ({ userId: p.userId, joinTime: p.joinTime.toISOString() })),
      description
    };

    try {
      const result = await fairWinnerSelection(aiInput);
      const winnerIdx = participants.findIndex(p => p.userId === result.winnerId);
      if (winnerIdx === -1) {
        throw new Error("AI returned a winner ID that doesn't match any participant.");
      }
      setWinner(result); // Set AI winner details
      setWheelWinnerIndex(winnerIdx); // Trigger wheel to spin to this winner
      // isSpinning remains true; WheelOfFortune's onSpinEnd will set it false.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during winner selection.';
      setError(message);
      toast({ title: 'AI Error', description: message, variant: 'destructive' });
      setIsLoading(false); // Stop loading indicator on error
      setIsSpinning(false); // Stop spinning on error
    }
  };
  
  const handleWheelSpinEnd = useCallback(() => {
    setIsSpinning(false);
    setIsLoading(false);
    if (wheelWinnerIndex !== null && winner) {
      setShowConfetti(true);
      const winnerParticipant = participants[wheelWinnerIndex];
      toast({ 
        title: '🎉 Winner Selected! 🎉', 
        description: `${winnerParticipant?.name} is the lucky winner!`,
        className: 'bg-primary text-primary-foreground border-accent ring-accent' 
      });
    }
  }, [wheelWinnerIndex, winner, participants, toast]);


  const winnerParticipantDetails = winner && wheelWinnerIndex !== null ? participants[wheelWinnerIndex] : null;

  return (
    <>
      {showConfetti && winner && <ConfettiEffect />}
      <div className="grid md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 shadow-lg rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl"><QrCode size={24}/> Share Draw</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-3 pt-2">
            {qrCodeValue ? (
              <div className="p-2 border rounded-md bg-white">
                <QRCode
                  value={qrCodeValue}
                  size={160} // Adjusted size
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  imageSettings={{ src: "https://placehold.co/32x32.png", height: 28, width: 28, excavate: true }}
                />
              </div>
            ) : (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground text-center px-2">
              Scan QR or share the URL to let others join or view the draw.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UsersRound size={24}/> Participants ({participants.length})
            </CardTitle>
            <CardDescription>Add participants to the draw. The more, the merrier!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!winner && (
              <div className="flex gap-2 items-end">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="participant-name">Participant Name</Label>
                  <Input
                    id="participant-name"
                    placeholder="Enter name"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddParticipant()}
                    disabled={isLoading || isSpinning}
                  />
                </div>
                <Button onClick={handleAddParticipant} disabled={isLoading || isSpinning} className="h-10">
                  <UserPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            )}

            <ScrollArea className="h-40 border rounded-md p-2 bg-background shadow-inner">
              {participants.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No participants yet. Add some to get started!
                </p>
              ) : (
                <ul className="space-y-2">
                  {participants.map((p, index) => (
                    <li
                      key={p.userId}
                      className={`p-2.5 rounded-md flex justify-between items-center text-sm shadow-sm transition-all duration-300 ease-in-out
                        ${winnerParticipantDetails?.userId === p.userId 
                          ? 'bg-accent text-accent-foreground font-semibold ring-2 ring-offset-2 ring-accent scale-105' 
                          : 'bg-secondary hover:bg-secondary/80'}`
                      }
                      style={{ borderColor: p.color }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ backgroundColor: p.color }} className="w-3 h-3 rounded-full inline-block shrink-0"></span>
                        <span>{index + 1}. {p.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDistanceToNow(p.joinTime, { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            
            {participants.length > 0 && !winner && (
              <div className="flex justify-center py-4 min-h-[340px] items-center">
                <WheelOfFortune
                  participants={participants}
                  winnerIndex={wheelWinnerIndex}
                  isSpinning={isSpinning}
                  onSpinEnd={handleWheelSpinEnd}
                />
              </div>
            )}
          </CardContent>

          {!winner && participants.length > 0 && (
            <CardFooter className="justify-center border-t pt-6">
              <Button
                onClick={handleSelectWinner}
                disabled={isLoading || isSpinning}
                size="lg"
                className="w-full md:w-auto py-6 text-lg shadow-md hover:shadow-lg transition-shadow"
              >
                {isLoading || isSpinning ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                {isLoading ? 'Selecting...' : (isSpinning ? 'Spinning...' : 'Pick the Lucky Winner!')}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {error && !isLoading && ( // Only show error card if not currently loading a new result
        <Card className="border-destructive bg-destructive/10 shadow-lg mt-6 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive text-lg"><AlertTriangle /> Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {winner && winnerParticipantDetails && !isSpinning && (
        <Card className="mt-8 bg-gradient-to-br from-primary via-purple-500 to-accent text-primary-foreground shadow-xl rounded-xl overflow-hidden">
          <CardHeader className="text-center pt-8 pb-4">
             <PartyPopper className="h-24 w-24 mx-auto mb-4 text-yellow-300 animate-bounce" />
            <CardTitle className="text-4xl md:text-5xl font-bold tracking-tight">Congratulations!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 px-6 pb-6">
            <p className="text-2xl md:text-3xl">The lucky winner is...</p>
            <p className="text-5xl md:text-6xl font-extrabold tracking-tight text-yellow-300 drop-shadow-lg animate-pulse">{winnerParticipantDetails.name}</p>
            <Separator className="my-6 bg-primary-foreground/30" />
            <div className="bg-black/20 p-4 rounded-lg shadow-inner">
              <p className="text-lg font-medium text-primary-foreground/90">AI's Wisdom:</p>
              <p className="text-md italic px-2 text-primary-foreground/80">"{winner.reason}"</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center bg-black/10 py-6">
            <Button 
              onClick={() => { 
                setWinner(null); 
                setShowConfetti(false); 
                // Do not clear participants automatically, user might want to re-spin or see list
                // setParticipants([]); 
                setError(null); 
                setWheelWinnerIndex(null);
                setIsSpinning(false); // ensure spinning stops
                setIsLoading(false); // ensure loading stops
              }} 
              variant="secondary" 
              size="lg"
              className="text-lg py-3 px-8 shadow-md hover:shadow-lg transition-shadow"
            >
              <UsersRound className="mr-2 h-5 w-5"/> View Participants / Reset
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

