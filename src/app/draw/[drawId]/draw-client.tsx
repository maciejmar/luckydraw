
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
  getDrawSnapshot, // Changed from getDrawData
  addParticipantToDb, 
  setDrawWinnerInDb, 
  updateDrawStatusInDb,
  type DrawData, 
  type Participant 
} from '@/lib/firebase'; 

interface DrawClientProps {
  drawId: string;
}

const POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds

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
  const [aiSelectedWinner, setAiSelectedWinner] = useState<FairWinnerSelectionOutput | null>(null);

  const { toast } = useToast();

  const participantColors = [
    '#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD',
    '#FF69B4', '#00CED1', '#FFA07A', '#FFC0CB', '#ADD8E6',
    '#90EE90', '#F0E68C', '#E6E6FA', '#FFB6C1', '#AFEEEE'
  ];

  const fetchAndUpdateDrawData = useCallback(async () => {
    // console.log(`[DrawClient] Polling for data: ${drawId}`);
    try {
      const data = await getDrawSnapshot(drawId);
      // console.log(`[DrawClient] Received polled data for ${drawId}:`, data);
      if (data) {
        const sanitizedData = {
          ...data,
          participants: data.participants || [], 
        };
        setDrawData(sanitizedData);
        if (sanitizedData.winner) {
          setShowConfetti(true);
          const winnerIdx = sanitizedData.participants.findIndex(p => p.userId === sanitizedData.winner!.winnerId);
          setWheelWinnerIndex(winnerIdx >= 0 ? winnerIdx : null);
          setIsLoadingAi(false); 
        } else {
          setShowConfetti(false);
           if (!isLoadingAi && !isSpinning) {
            setWheelWinnerIndex(null);
          }
        }
        setError(null); // Clear previous errors on successful fetch
      } else {
        // Only set error if it's not the initial page load and data becomes null
        // Or if it's initial load and data is null
        if (!isPageLoading || (isPageLoading && !drawData)) {
            setError(`Draw with ID "${drawId}" not found or has been cleared.`);
        }
        setDrawData(null);
      }
    } catch (err) {
      console.error("[DrawClient] Error fetching draw data:", err);
      const message = err instanceof Error ? err.message : "Could not fetch draw data.";
      setError(message);
      // toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      if (isPageLoading) setIsPageLoading(false);
    }
  }, [drawId, isPageLoading, drawData, isLoadingAi, isSpinning]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrCodeValue(window.location.href);
    }

    setIsPageLoading(true);
    fetchAndUpdateDrawData(); // Initial fetch

    const intervalId = setInterval(fetchAndUpdateDrawData, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawId]); // fetchAndUpdateDrawData is memoized and stable if its own dependencies are stable

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
    
    const assignedColor = participantColors[(drawData.participants.length || 0) % participantColors.length];
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
      fetchAndUpdateDrawData(); // Re-fetch immediately after adding
    } catch (err) {
      console.error('Failed to add participant:', err);
      const message = err instanceof Error ? err.message : 'Could not add participant.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [newParticipantName, drawData, drawId, toast, participantColors, fetchAndUpdateDrawData]);

  const handleSelectWinner = async () => {
    if (!drawData || !drawData.participants || drawData.participants.length < 1) {
      toast({ title: 'Error', description: 'Add at least one participant to start the draw.', variant: 'destructive' });
      return;
    }
    if (drawData.status !== 'open') {
      toast({ title: 'Error', description: 'This draw is already closed or a winner is being selected.', variant: 'destructive' });
      return;
    }

    setIsLoadingAi(true);
    setIsSpinning(true); 
    setError(null);
    setShowConfetti(false);
    setWheelWinnerIndex(null);
    setAiSelectedWinner(null);

    try {
      await updateDrawStatusInDb(drawId, 'selecting'); 
      fetchAndUpdateDrawData(); // Update status for UI
      const aiInput: FairWinnerSelectionInput = {
        participants: drawData.participants.map(p => ({ userId: p.userId, joinTime: p.joinTime })),
        description: drawData.description
      };
      const result = await fairWinnerSelection(aiInput);
      setAiSelectedWinner(result); 
      
      const winnerIdx = drawData.participants.findIndex(p => p.userId === result.winnerId);
      if (winnerIdx === -1) {
        throw new Error("AI returned a winner ID that doesn't match any participant.");
      }
      
      setWheelWinnerIndex(winnerIdx); 
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during winner selection.';
      setError(message);
      toast({ title: 'AI Error', description: message, variant: 'destructive' });
      setIsLoadingAi(false);
      setIsSpinning(false);
      setAiSelectedWinner(null);
      if (drawData && drawData.status === 'selecting') {
        await updateDrawStatusInDb(drawId, 'open');
        fetchAndUpdateDrawData(); // Update status for UI
      }
    }
  };
  
  const handleWheelSpinEnd = useCallback(async () => {
    setIsSpinning(false); 
    
    if (aiSelectedWinner && drawData && drawData.status === 'selecting') {
      try {
        await setDrawWinnerInDb(drawId, aiSelectedWinner); 
        fetchAndUpdateDrawData(); // Fetch the final state with winner
        toast({ 
          title: '🎉 Winner Confirmed! 🎉', 
          description: `${drawData.participants.find(p=>p.userId === aiSelectedWinner.winnerId)?.name} is the lucky winner! Reason: ${aiSelectedWinner.reason}`,
          className: 'bg-primary text-primary-foreground border-accent ring-accent' 
        });
      } catch (dbError) {
        const message = dbError instanceof Error ? dbError.message : 'Failed to save winner.';
        setError(message);
        toast({ title: 'Database Error', description: message, variant: 'destructive' });
        await updateDrawStatusInDb(drawId, 'open'); 
        fetchAndUpdateDrawData(); // Update status for UI
      } finally {
        setIsLoadingAi(false);
        setAiSelectedWinner(null);
      }
    } else if (drawData && drawData.winner) {
        setShowConfetti(true);
        setIsLoadingAi(false);
    }
  }, [aiSelectedWinner, drawData, drawId, toast, fetchAndUpdateDrawData]);


  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrCodeValue).then(() => {
      toast({ title: 'Link Copied!', description: 'Draw link copied to clipboard.' });
    }).catch(err => {
      toast({ title: 'Error', description: 'Could not copy link.', variant: 'destructive' });
    });
  };
  
  const winnerParticipantDetails = drawData?.winner && drawData.participants.find(p => p.userId === drawData.winner!.winnerId);

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Draw Details...</p>
      </div>
    );
  }

  if (!drawData && !isPageLoading) { 
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
  
  if (!drawData) return null; // Should be caught by above, but as a safeguard


  return (
    <>
      {showConfetti && drawData.winner && <ConfettiEffect />}
      <div className="mb-4 p-4 bg-card border rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-primary">{drawData.description}</h2>
        <p className="text-sm text-muted-foreground">Draw ID: {drawId}</p>
        <p className="text-xs text-muted-foreground">Status: {drawData.status}</p>
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
              <UsersRound size={24}/> Participants ({(drawData.participants || []).length})
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
              {(drawData.participants || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No participants yet. Add some to get started!
                </p>
              ) : (
                <ul className="space-y-2">
                  {(drawData.participants || []).map((p, index) => (
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
            
            {((drawData.participants || []).length > 0 && (!drawData.winner || isSpinning)) && (
              <div className="flex justify-center py-4 min-h-[340px] items-center">
                <WheelOfFortune
                  participants={(drawData.participants || []).map(p => ({userId: p.userId, name: p.name, color: p.color}))}
                  winnerIndex={wheelWinnerIndex}
                  isSpinning={isSpinning || drawData.status === 'selecting'}
                  onSpinEnd={handleWheelSpinEnd}
                />
              </div>
            )}
          </CardContent>

          {drawData.status === 'open' && !drawData.winner && (drawData.participants || []).length > 0 && (
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
