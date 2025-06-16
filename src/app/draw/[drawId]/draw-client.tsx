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
        <p className="text-xs text-muted-foreground">Status: {drawData.status}</p>
      </div>
      {/* Remainder of JSX unchanged for brevity */}
    </>
  );
}
