'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  fairWinnerSelection,
  type FairWinnerSelectionInput,
  type FairWinnerSelectionOutput,
} from '@/ai/flows/fair-winner-selection';
import ConfettiEffect from '@/components/ConfettiEffect';
import {
  QrCode,
  UsersRound,
  UserPlus,
  PlayCircle,
  Loader2,
  AlertTriangle,
  PartyPopper,
  Copy,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WheelOfFortune from '@/components/WheelOfFortune';
import {
  getDrawSnapshot,
  addParticipantToDb,
  setDrawWinnerInDb,
  updateDrawStatusInDb,
  type DrawData,
  type Participant,
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
    '#90EE90', '#F0E68C', '#E6E6FA', '#FFB6C1', '#AFEEEE',
  ];

  const fetchAndUpdateDrawData = useCallback(async () => {
    try {
      const data = await getDrawSnapshot(drawId);
      if (data) {
        const sanitizedData: DrawData = {
          ...data,
          participants: data.participants || [],
        };
        setDrawData(sanitizedData);
        if (sanitizedData.winner) {
          setShowConfetti(true);
          const idx = sanitizedData.participants.findIndex(
            (p) => p.userId === sanitizedData.winner!.winnerId
          );
          setWheelWinnerIndex(idx >= 0 ? idx : null);
          setIsLoadingAi(false);
        } else {
          setShowConfetti(false);
          if (!isLoadingAi && !isSpinning) {
            setWheelWinnerIndex(null);
          }
        }
        setError(null);
      } else {
        if (!isPageLoading || (isPageLoading && !drawData)) {
          setError(
            `Draw with ID "${drawId}" not found or has been cleared.`
          );
        }
        setDrawData(null);
      }
    } catch (err) {
      console.error('[DrawClient] Error fetching draw data:', err);
      setError(err instanceof Error ? err.message : 'Could not fetch draw data.');
    } finally {
      if (isPageLoading) setIsPageLoading(false);
    }
  }, [drawId, isPageLoading, drawData, isLoadingAi, isSpinning]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrCodeValue(window.location.href);
    }
    setIsPageLoading(true);
    fetchAndUpdateDrawData();
    const intervalId = setInterval(fetchAndUpdateDrawData, POLLING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [drawId]);

  const handleAddParticipant = useCallback(async () => {
    if (!drawData || drawData.status !== 'open') {
      toast({
        title: 'Error',
        description: 'This draw is not open for new participants.',
        variant: 'destructive',
      });
      return;
    }
    if (!newParticipantName.trim()) {
      toast({
        title: 'Error',
        description: 'Participant name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (
      drawData.participants.some(
        (p) => p.name.toLowerCase() === newParticipantName.trim().toLowerCase()
      )
    ) {
      toast({
        title: 'Error',
        description: 'Participant with this name already exists.',
        variant: 'destructive',
      });
      return;
    }
    const color =
      participantColors[drawData.participants.length % participantColors.length];
    const newP: Participant = {
      userId: `user-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`,
      name: newParticipantName.trim(),
      joinTime: new Date().toISOString(),
      color,
    };
    try {
      await addParticipantToDb(drawId, newP);
      setNewParticipantName('');
      toast({
        title: 'Participant Added',
        description: `${newP.name} has joined the draw!`,
      });
      fetchAndUpdateDrawData();
    } catch (err) {
      console.error('Failed to add participant:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not add participant.',
        variant: 'destructive',
      });
    }
  }, [newParticipantName, drawData, drawId, toast, participantColors, fetchAndUpdateDrawData]);

  const handleSelectWinner = async () => {
    if (!drawData || drawData.participants.length < 1) {
      toast({
        title: 'Error',
        description: 'Add at least one participant to start the draw.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingAi(true);
    setIsSpinning(true);
    setError(null);
    setShowConfetti(false);
    setWheelWinnerIndex(null);
    setAiSelectedWinner(null);

    try {
      // Move status check inside try
      if (drawData.status !== 'open') {
        toast({
          title: 'Error',
          description: 'This draw is already closed or in progress.',
          variant: 'destructive',
        });
        setIsLoadingAi(false);
        setIsSpinning(false);
        return;
      }
      await updateDrawStatusInDb(drawId, 'selecting');
      fetchAndUpdateDrawData();

      const aiInput: FairWinnerSelectionInput = {
        participants: drawData.participants.map((p) => ({
          userId: p.userId,
          joinTime: p.joinTime,
        })),
        description: drawData.description,
      };
      const result = await fairWinnerSelection(aiInput);
      setAiSelectedWinner(result);

      const idx = drawData.participants.findIndex(
        (p) => p.userId === result.winnerId
      );
      if (idx === -1)
        throw new Error("AI returned a winner ID that doesn't match any participant.");
      setWheelWinnerIndex(idx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during winner selection.';
      setError(msg);
      toast({ title: 'AI Error', description: msg, variant: 'destructive' });
      setIsLoadingAi(false);
      setIsSpinning(false);
      setAiSelectedWinner(null);
      // Roll back if we had set to selecting
      if (drawData.status === 'selecting') {
        await updateDrawStatusInDb(drawId, 'open');
        fetchAndUpdateDrawData();
      }
    }
  };

  const handleWheelSpinEnd = useCallback(async () => {
    setIsSpinning(false);

    if (aiSelectedWinner && drawData && drawData.status === 'selecting') {
      try {
        await setDrawWinnerInDb(drawId, aiSelectedWinner);
        fetchAndUpdateDrawData();
        toast({
          title: '🎉 Winner Confirmed! 🎉',
          description: `${drawData.participants.find(
            (p) => p.userId === aiSelectedWinner.winnerId
          )?.name} is the lucky winner! Reason: ${aiSelectedWinner.reason}`,
          className: 'bg-primary text-primary-foreground border-accent ring-accent',
        });
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Failed to save winner.';
        setError(msg);
        toast({ title: 'Database Error', description: msg, variant: 'destructive' });
        await updateDrawStatusInDb(drawId, 'open');
        fetchAndUpdateDrawData();
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
    navigator.clipboard
      .writeText(qrCodeValue)
      .then(() =>
        toast({ title: 'Link Copied!', description: 'Draw link copied to clipboard.' })
      )
      .catch(() =>
        toast({ title: 'Error', description: 'Could not copy link.', variant: 'destructive' })
      );
  };

  const winnerParticipantDetails =
    drawData?.winner &&
    drawData.participants.find((p) => p.userId === drawData.winner!.winnerId);

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Draw Details...</p>
      </div>
    );
  }

  if (!drawData) {
    return (
      <Card className="border-destructive bg-destructive/10 shadow-lg mt-6 rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive text-lg">
            <AlertTriangle /> Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive-foreground">{error || `Draw with ID "${drawId}" could not be loaded.`}</p>
          <Button onClick={() => (window.location.href = '/')} className="mt-4">
            Go to Homepage
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {showConfetti && drawData.winner && <ConfettiEffect />}
      <div className="mb-4 p-4 bg-card border rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-primary">{drawData.description}</h2>
        <p className="text-sm text-muted-foreground">Draw ID: {drawId}</p>
        <p className="text-xs text-muted-foreground">
          Status: {drawData.status.charAt(0).toUpperCase() + drawData.status.slice(1)}
        </p>
 {drawData.createdAt && (
 <p className="text-xs text-muted-foreground">
            Created:{' '}
 {formatDistanceToNow(new Date(drawData.createdAt), {
 suffix: true,
 })}
 </p>
 )}
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 shadow-lg mt-6 rounded-xl">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-destructive text-lg">
 <AlertTriangle /> Error
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-destructive-foreground">{error}</p>
 </CardContent>
 </Card>
 )}

 {/* Main Layout */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Left Column: Wheel, Winner Info, Select Winner Button */}
 <div className="flex flex-col items-center">
          <Card className="w-full max-w-md mb-6 shadow-lg rounded-xl">
 <CardContent className="flex flex-col items-center p-6">
              {drawData.participants.length > 0 ? (
                <WheelOfFortune
                  segments={drawData.participants.map((p) => p.name)}
                  participants={drawData.participants.map(p => ({ userId: p.userId, name: p.name, color: p.color }))}
                  winnerIndex={wheelWinnerIndex}
                  isSpinning={isSpinning}
                  onSpinEnd={handleWheelSpinEnd}
                />
 ) : (
 <div className="text-center text-muted-foreground">
 <p>Add participants to spin the wheel!</p>
 </div>
 )}

              {drawData.status === 'open' && drawData.participants.length > 0 && (
 <Button
 onClick={handleSelectWinner}
                  className="mt-6 w-full"
 disabled={isLoadingAi || isSpinning || drawData.status !== 'open'}
 >
                  {isLoadingAi ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <PlayCircle className="mr-2 h-4 w-4" />
 )}
                  {isLoadingAi ? 'Selecting Winner...' : 'Select Winner'}
 </Button>
 )}

              {drawData.winner && winnerParticipantDetails && (
 <div className="mt-8 text-center">
 <PartyPopper className="w-12 h-12 text-accent mx-auto mb-2" />
 <p className="text-2xl font-bold text-primary">Winner:</p>
 <p className="text-3xl font-extrabold text-accent">
                    {winnerParticipantDetails.name}
 </p>
                  {drawData.winner.reason && (
 <p className="text-sm text-muted-foreground mt-2">
                      Reason: {drawData.winner.reason}
 </p>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Right Column: QR Code, Add Participant, Participant List */}
 <div className="flex flex-col gap-6">
 {/* QR Code Section */}
            <Card className="shadow-lg rounded-xl">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <QrCode className="w-5 h-5" /> Share This Draw
 </CardTitle>
 <CardDescription>
                    Scan the QR code or share the link below for participants to join.
 </CardDescription>
 </CardHeader>
 <CardContent className="flex flex-col items-center gap-4">
 {qrCodeValue && (
 <QRCode value={qrCodeValue} size={180} level="H" />
 )}
 <div className="flex w-full max-w-sm items-center space-x-2">
 <Input type="text" value={qrCodeValue} readOnly className="flex-grow" />
 <Button onClick={handleCopyLink} size="sm">
 <Copy className="h-4 w-4 mr-1" /> Copy
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Add Participant Section */}
            <Card className="shadow-lg rounded-xl">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <UserPlus className="w-5 h-5" /> Add Participant
 </CardTitle>
 </CardHeader>
 <CardContent className="flex flex-col gap-4">
 <div className="grid w-full items-center gap-1.5">
 <Label htmlFor="participant-name">Participant Name</Label>
 <Input
 type="text"
 id="participant-name"
 placeholder="Enter name"
 value={newParticipantName}
 onChange={(e) => setNewParticipantName(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 handleAddParticipant();
                        }
                      }}
 disabled={drawData.status !== 'open' || isLoadingAi || isSpinning}
 />
 </div>
 <Button
 onClick={handleAddParticipant}
 disabled={
 drawData.status !== 'open' ||
 !newParticipantName.trim() ||
 isLoadingAi ||
 isSpinning
 }
 >
 <UserPlus className="mr-2 h-4 w-4" /> Add Participant
 </Button>
 </CardContent>
 </Card>

 {/* Participant List Section */}
            <Card className="shadow-lg rounded-xl">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <UsersRound className="w-5 h-5" /> Participants ({drawData.participants.length})
 </CardTitle>
 </CardHeader>
              {drawData.participants.length > 0 ? (
 <CardContent className="p-0">
 <ScrollArea className="h-60 w-full rounded-md border">
 <div className="p-4">
                        {drawData.participants.map((participant, index) => (
 <React.Fragment key={participant.userId}>
 <div className="flex justify-between items-center py-2">
 <div className="flex items-center gap-2">
 <span
 className="inline-block w-3 h-3 rounded-full"
 style={{ backgroundColor: participant.color }}
                          ></span>
 <span className="font-medium">{participant.name}</span>
 </div>
 <span className="text-sm text-muted-foreground">
                              Joined:{' '}
                              {formatDistanceToNow(new Date(participant.joinTime), {
 suffix: true,
                              })}
 </span>
 </div>
                          {index < drawData.participants.length - 1 && <Separator />}
 </React.Fragment>
                        ))}
 </div>
 </ScrollArea>
 </CardContent>
 ) : (
 <CardContent>
 <p className="text-muted-foreground">No participants added yet.</p>
 </CardContent>
 )}
 </Card>
 </div>
 </div>
    </>
  );
}
