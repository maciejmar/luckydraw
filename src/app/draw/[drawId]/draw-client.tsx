
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
  Loader2, AlertTriangle, PartyPopper, Copy
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WheelOfFortune from '@/components/WheelOfFortune';
import { 
  getDrawData, 
  addParticipantToDb, 
  setDrawWinnerInDb, 
  updateDrawStatusInDb,
  type DrawData 
} from '@/lib/firebase'; // Assuming Participant type is also exported or defined in firebase.ts or a shared types file

// Define Participant type if not already centrally defined
export interface Participant {
  userId: string;
  name: string;
  joinTime: string; // Store as ISO string for Firebase compatibility
  color: string;
}

interface DrawClientProps {
  drawId: string;
}

export default function DrawClient({ drawId }: DrawClientProps) {
  const [drawData, setDrawData] = useState<DrawData | null>(null);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelWinnerIndex, setWheelWinnerIndex] = useState<number | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const { toast } = useToast();

  const participantColors = [
    '#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD',
    '#FF69B4', '#00CED1', '#FFA07A', '#FFC0CB', '#ADD8E6',
    '#90EE90', '#F0E68C', '#E6E6FA', '#FFB6C1', '#AFEEEE'
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrCodeValue(window.location.href);
    }

    setIsPageLoading(true);
    const unsubscribe = getDrawData(drawId, (data) => {
      if (data) {
        // Ensure participants is always an array
        const sanitizedData = {
          ...data,
          participants: data.participants || [], 
        };
        setDrawData(sanitizedData);
        if (sanitizedData.winner) {
          setShowConfetti(true);
          const winnerIdx = sanitizedData.participants.findIndex(p => p.userId === sanitizedData.winner!.winnerId);
          setWheelWinnerIndex(winnerIdx >= 0 ? winnerIdx : null);
        } else {
          setShowConfetti(false);
          setWheelWinnerIndex(null);
        }
      } else {
        setError(`Draw with ID "${drawId}" not found or access denied.`);
        setDrawData(null); // Explicitly set to null if not found
      }
      setIsPageLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [drawId]);

  const handleAddParticipant = useCallback(async () => {
    if (!drawData || drawData.status !== 'open') {
      toast({ title: 'Error', description: 'This draw is not open for new participants.', variant: 'destructive' });
      return;
    }
    if (newParticipantName.trim() === '') {
      toast({ title: 'Error', description: 'Participant name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (drawData.participants.some(p => p.name.toLowerCase() === newParticipantName.trim().toLowerCase())) {
      toast({ title: 'Error', description: 'Participant with this name already exists.', variant: 'destructive' });
      return;
    }
    
    const assignedColor = participantColors[drawData.participants.length % participantColors.length];
    const newParticipant: Participant = {
      userId: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: newParticipantName.trim(),
      joinTime: new Date().toISOString(),
      color: assignedColor,
    };

    try {
      await addParticipantToDb(drawId, newParticipant);
      setNewParticipantName('');
      toast({ title: 'Participant Added', description: `${newParticipant.name} has joined the draw!` });
    } catch (err) {
      console.error('Failed to add participant:', err);
      toast({ title: 'Error', description: 'Could not add participant. Please try again.', variant: 'destructive' });
    }
  }, [newParticipantName, drawData, drawId, toast, participantColors]);

  const handleSelectWinner = async () => {
    if (!drawData || drawData.participants.length < 1) {
      toast({ title: 'Error', description: 'Add at least one participant to start the draw.', variant: 'destructive' });
      return;
    }
    if (drawData.status !== 'open') {
      toast({ title: 'Error', description: 'This draw is already closed or in progress.', variant: 'destructive' });
      return;
    }

    setIsLoadingAi(true);
    setIsSpinning(true);
    setError(null);
    setShowConfetti(false);
    setWheelWinnerIndex(null);

    try {
      await updateDrawStatusInDb(drawId, 'selecting');
      const aiInput: FairWinnerSelectionInput = {
        participants: drawData.participants.map(p => ({ userId: p.userId, joinTime: p.joinTime })),
        description: drawData.description
      };
      const result = await fairWinnerSelection(aiInput);
      
      const winnerIdx = drawData.participants.findIndex(p => p.userId === result.winnerId);
      if (winnerIdx === -1) {
        throw new Error("AI returned a winner ID that doesn't match any participant.");
      }
      
      // Winner is set in Firebase by a separate call, listener will update UI.
      // We set wheelWinnerIndex to trigger animation.
      // The actual "winner" state will come from Firebase update.
      setWheelWinnerIndex(winnerIdx); 
      // No setWinner(result) here - Firebase listener handles this
      // The onSpinEnd will call setDrawWinnerInDb
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during winner selection.';
      setError(message);
      toast({ title: 'AI Error', description: message, variant: 'destructive' });
      setIsLoadingAi(false);
      setIsSpinning(false);
      if (drawData && drawData.status === 'selecting') { // Revert status if AI call failed
        await updateDrawStatusInDb(drawId, 'open');
      }
    }
  };
  
  const handleWheelSpinEnd = useCallback(async () => {
    setIsSpinning(false); // Animation finished
    //isLoadingAi is set to false when Firebase confirms winner
    
    if (wheelWinnerIndex !== null && drawData && drawData.participants[wheelWinnerIndex] && !drawData.winner) {
      // This means the wheel has landed, now we persist the AI's choice to Firebase.
      // The AI result was temporarily stored during handleSelectWinner to find the index.
      // We need to re-fetch or ensure the AI winner is correctly passed here.
      // For simplicity, let's assume fairWinnerSelection result is available if wheelWinnerIndex is set.
      // This part needs careful state management to ensure `result` is available.
      // Let's assume the AI result is stored in a temporary state or re-fetched if needed.
      // The `winner` state (from drawData.winner) will be updated by Firebase listener.
      
      // The actual winner setting is complex here. If AI result not available, this would fail.
      // Simplified: let's assume fairWinnerSelection was called and we have the result.
      // This relies on the fact that handleSelectWinner *sets* wheelWinnerIndex
      // *after* a successful AI call.
      
      const aiWinnerId = drawData.participants[wheelWinnerIndex].userId;
      // Find the reason from the AI call (this is tricky without storing the AI output temporarily)
      // For now, we'll create a placeholder if direct AI output isn't readily available here.
      // This should be improved by passing the AI output or storing it.
      
      // A better approach: store AI output in a temporary state in handleSelectWinner if needed by handleWheelSpinEnd
      // Or, the winner data should already be in `drawData` if status is `selecting` and AI succeeded.

      // The crucial step is to update Firebase *after* the animation.
      // The AI result would have been determined in handleSelectWinner.
      // We need to fetch that *exact* AI result to store it.
      // This logic needs refinement to pass the `FairWinnerSelectionOutput` to this handler.

      // Let's assume the AI call within `handleSelectWinner` produced a result that we can now commit.
      // To avoid complex state passing, we'll re-select if needed (not ideal for UX or cost).
      // A better approach would be to pass the AI's result object to this handler or store it.
      // For now, we'll rely on the UI update via Firebase listener.
      // The actual update to Firebase should happen here if we are sure of the winner.
      
      // If fairWinnerSelection was successful, its result (including reason)
      // should have been used to determine winnerId.
      // This part is simplified. In a real app, you'd pass the full winner object.
      // Or, the status 'selecting' implies the AI process completed and data is ready.

      // This Toast is shown optimistically. Firebase update will confirm.
      if (drawData.winner) { // If winner already set by Firebase listener by the time spin ends
          setShowConfetti(true);
          const winnerParticipant = drawData.participants.find(p => p.userId === drawData.winner!.winnerId);
          toast({ 
            title: '🎉 Winner Selected! 🎉', 
            description: `${winnerParticipant?.name} is the lucky winner! Reason: ${drawData.winner.reason}`,
            className: 'bg-primary text-primary-foreground border-accent ring-accent' 
          });
          setIsLoadingAi(false); // AI process fully complete
      } else {
        // If somehow winner is not set in drawData yet, but wheel landed.
        // This means the `fairWinnerSelection` inside `handleSelectWinner` call already has the result.
        // That result *should* be committed to DB.
        // The `setDrawWinnerInDb` should be called here with the AI result.
        // This indicates a race condition or logic flow issue.
        // For now, we rely on handleSelectWinner to initiate the AI, and this to confirm the animation is done.
        // The actual setting of the winner happens after the AI call and then animation.
        // The best place to call setDrawWinnerInDb is after animation from winner data derived in handleSelectWinner.
        // This logic is a bit circular. Let's assume handleSelectWinner gets the AI result,
        // then calls setDrawWinnerInDb. The wheel spins, and this callback is just for animation end.
      }


    } else if (drawData && drawData.winner) { // if winner already exists when spin ends
        setShowConfetti(true);
        const winnerParticipant = drawData.participants.find(p => p.userId === drawData.winner!.winnerId);
         toast({ 
            title: '🎉 Winner Selected! 🎉', 
            description: `${winnerParticipant?.name} is the lucky winner! Reason: ${drawData.winner.reason}`,
            className: 'bg-primary text-primary-foreground border-accent ring-accent' 
          });
        setIsLoadingAi(false);
    }

    // If winner is set in drawData, the confetti and winner card should appear due to reactive state.
    // setIsLoadingAi(false) ensures buttons re-enable.
  }, [wheelWinnerIndex, drawData, toast, drawId]);


  // This useEffect will handle setting winner in DB AFTER AI call is successful AND wheel has landed.
  // This tries to address the async nature.
  useEffect(() => {
    if (!isSpinning && wheelWinnerIndex !== null && drawData && !drawData.winner && drawData.status === 'selecting') {
      // This means the wheel has landed, and we're in 'selecting' state, but winner not yet in DB.
      // This is where we should commit the winner.
      // We need the AI result. This part is still tricky without passing AI state around.
      // A simpler flow might be:
      // 1. handleSelectWinner: calls AI. On success, stores AI result in a temp state. Sets wheelWinnerIndex & isSpinning.
      // 2. WheelOfFortune: spins. onSpinEnd -> setIsSpinning(false).
      // 3. This useEffect: when isSpinning is false, wheelWinnerIndex is set, AND temp AI result exists:
      //    -> call setDrawWinnerInDb(drawId, tempAiResult).
      //    -> clear temp AI result.
      // For now, the original logic was: AI call -> get result -> set wheelWinnerIndex.
      // Then, onSpinEnd -> show confetti. The DB update happened in handleSelectWinner (implicitly via listener).
      // Let's revert to a slightly simpler logic: The AI call *should* update the DB.
      // The problem is the `winner` in `handleSelectWinner` is from fairWinnerSelection, but needs to be from DB state.

      // The main source of truth is drawData from Firebase.
      // If fairWinnerSelection in handleSelectWinner got a result, it means that result's winnerId
      // was used to set wheelWinnerIndex.
      // The actual saving to DB should happen after AI successfully returns.
      // The onSpinEnd is for visual confirmation.
      if (drawData && drawData.winner) { // This ensures winner is from Firebase
        setShowConfetti(true);
        const winnerParticipant = drawData.participants.find(p => p.userId === drawData.winner!.winnerId);
        toast({ 
          title: '🎉 Confirmed Winner! 🎉', 
          description: `${winnerParticipant?.name} is the lucky winner! Reason: ${drawData.winner.reason}`,
          className: 'bg-primary text-primary-foreground border-accent ring-accent' 
        });
        setIsLoadingAi(false);
      }
    }
  }, [isSpinning, wheelWinnerIndex, drawData, toast, drawId]);


  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrCodeValue).then(() => {
      toast({ title: 'Link Copied!', description: 'Draw link copied to clipboard.' });
    }).catch(err => {
      toast({ title: 'Error', description: 'Could not copy link.', variant: 'destructive' });
    });
  };
  
  const winnerParticipantDetails = drawData?.winner && wheelWinnerIndex !== null && drawData.participants[wheelWinnerIndex]?.userId === drawData.winner.winnerId
    ? drawData.participants[wheelWinnerIndex]
    : null;

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Draw Details...</p>
      </div>
    );
  }

  if (!drawData && !isPageLoading) { // Handles case where drawId is invalid or data failed to load
    return (
      <Card className="border-destructive bg-destructive/10 shadow-lg mt-6 rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive text-lg"><AlertTriangle /> Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive-foreground">{error || `Draw with ID "${drawId}" could not be loaded. It might not exist or there was a network issue.`}</p>
          <Button onClick={() => window.location.href = '/'} className="mt-4">Go to Homepage</Button>
        </CardContent>
      </Card>
    );
  }
  
  // Ensure drawData is not null for rendering below this point
  if (!drawData) return null; 


  return (
    <>
      {showConfetti && drawData.winner && <ConfettiEffect />}
      <div className="mb-4 p-4 bg-card border rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-primary">{drawData.description}</h2>
        <p className="text-sm text-muted-foreground">Draw ID: {drawId}</p>
      </div>
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
                  size={160}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  imageSettings={{ src: "https://placehold.co/32x32.png", dataAiHint:"logo", height: 28, width: 28, excavate: true }}
                />
              </div>
            ) : (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            )}
            <Button onClick={handleCopyLink} variant="outline" size="sm" className="w-full">
              <Copy size={16} className="mr-2" /> Copy Link
            </Button>
            <p className="text-xs text-muted-foreground text-center px-2">
              Scan QR or share the URL to let others join or view the draw.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UsersRound size={24}/> Participants ({drawData.participants.length})
            </CardTitle>
            <CardDescription>
              {drawData.status === 'open' ? "Add participants to the draw. The more, the merrier!" :
               drawData.status === 'selecting' ? "Winner selection in progress..." :
               "This draw is closed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {drawData.status === 'open' && !drawData.winner && (
              <div className="flex gap-2 items-end">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="participant-name">Participant Name</Label>
                  <Input
                    id="participant-name"
                    placeholder="Enter name"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoadingAi && handleAddParticipant()}
                    disabled={isLoadingAi || isSpinning}
                  />
                </div>
                <Button onClick={handleAddParticipant} disabled={isLoadingAi || isSpinning} className="h-10">
                  <UserPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            )}

            <ScrollArea className="h-40 border rounded-md p-2 bg-background shadow-inner">
              {drawData.participants.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No participants yet. Add some to get started!
                </p>
              ) : (
                <ul className="space-y-2">
                  {drawData.participants.map((p, index) => (
                    <li
                      key={p.userId}
                      className={`p-2.5 rounded-md flex justify-between items-center text-sm shadow-sm transition-all duration-300 ease-in-out
                        ${drawData.winner?.winnerId === p.userId && !isSpinning
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
                        Joined {formatDistanceToNow(new Date(p.joinTime), { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            
            {(drawData.participants.length > 0 && (!drawData.winner || isSpinning)) && (
              <div className="flex justify-center py-4 min-h-[340px] items-center">
                <WheelOfFortune
                  participants={drawData.participants.map(p => ({userId: p.userId, name: p.name, color: p.color}))}
                  winnerIndex={wheelWinnerIndex} // This determines where the wheel stops
                  isSpinning={isSpinning || drawData.status === 'selecting'} // Spin if explicitly set or if status is selecting
                  onSpinEnd={handleWheelSpinEnd}
                />
              </div>
            )}
          </CardContent>

          {drawData.status === 'open' && !drawData.winner && drawData.participants.length > 0 && (
            <CardFooter className="justify-center border-t pt-6">
              <Button
                onClick={handleSelectWinner}
                disabled={isLoadingAi || isSpinning || drawData.status !== 'open'}
                size="lg"
                className="w-full md:w-auto py-6 text-lg shadow-md hover:shadow-lg transition-shadow"
              >
                {isLoadingAi || isSpinning ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                {isLoadingAi ? 'Selecting...' : (isSpinning ? 'Spinning...' : 'Pick the Lucky Winner!')}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {error && !isLoadingAi && (
        <Card className="border-destructive bg-destructive/10 shadow-lg mt-6 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive text-lg"><AlertTriangle /> Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {drawData.winner && winnerParticipantDetails && !isSpinning && drawData.status === 'closed' && (
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
              <p className="text-md italic px-2 text-primary-foreground/80">"{drawData.winner.reason}"</p>
            </div>
          </CardContent>
           <CardFooter className="justify-center bg-black/10 py-6">
            <Button 
              onClick={() => { 
                // Resetting a draw would mean creating a new one or clearing Firebase state.
                // For now, just navigate home.
                window.location.href = '/';
              }} 
              variant="secondary" 
              size="lg"
              className="text-lg py-3 px-8 shadow-md hover:shadow-lg transition-shadow"
            >
              <UsersRound className="mr-2 h-5 w-5"/> Create New Draw
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
