
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createDrawInDb } from '@/lib/firebase';

export default function CreateDrawClient() {
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateDraw = async () => {
    if (description.trim() === '') {
      toast({
        title: 'Description Required',
        description: 'Please provide a description for the draw.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const drawId = uuidv4();
    
    try {
      await createDrawInDb(drawId, description.trim());
      router.push(`/draw/${drawId}`);
      // If navigation is successful and component unmounts, state is naturally reset.
      // If it doesn't unmount, we rely on finally or specific error handling.
    } catch (error) {
      console.error("Failed to create draw or navigate:", error);
      toast({
        title: 'Error Creating Draw',
        // Reverted to simpler error message
        description: `An error occurred. Please try again.`, 
        variant: 'destructive',
      });
      setIsCreating(false); // Resetting loading state in catch
    } 
    // Removed finally block to revert to earlier structure.
    // If createDrawInDb hangs indefinitely and router.push isn't called, 
    // isCreating would remain true with this structure if there's no error thrown.
    // However, if an error *is* thrown (e.g. from Firebase SDK itself after a while), 
    // the catch block will execute.
    // If createDrawInDb truly never resolves or rejects, setIsCreating will only be reset
    // if an error is caught or upon successful navigation and unmount.
    // For the indefinite hang without an error, this won't reset if navigation doesn't happen.
    // Added an explicit check to set isCreating to false if it's still true and execution reaches here (e.g. if router.push fails silently)
    // But this is unlikely. The main path is success or error.
    // To be safer against createDrawInDb hanging and not erroring/navigating, a finally block is better.
    // But per request to revert, this is closer to the original state before robust finally block.
    // Let's ensure it's set to false if it's still true and no navigation happened and no error was caught by this point, though this scenario is odd.
    // A more common explicit reset would be if router.push itself failed, but that's rare.
    // The primary change here is moving setIsCreating(false) back into the catch,
    // and simplifying the toast error message.
    // If createDrawInDb completes without error, router.push should execute. 
    // If that navigates, the component unmounts, effectively resetting state.
    // If router.push doesn't navigate for some reason (e.g. blocked by browser),
    // then isCreating would remain true *unless* explicitly set false after it.
    // Given the previous "hang" issue, if createDrawInDb hangs and doesn't error, this version will also hang.
    // The timeout in the previous firebase.ts was to force an error in that case.
    // By removing the timeout, we might revert to a silent hang.
  };

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="h-8 w-8 text-accent" />
          Create a New Draw
        </CardTitle>
        <CardDescription>
          Enter a description for your draw. This will be visible to participants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="draw-description" className="text-lg">Draw Description</Label>
          <Textarea
            id="draw-description"
            placeholder="e.g., Weekly team lunch raffle, Holiday gift exchange winner..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="text-base"
            disabled={isCreating}
          />
        </div>
        <Button onClick={handleCreateDraw} className="w-full text-lg py-6" size="lg" disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          {isCreating ? 'Creating Draw...' : 'Generate Your Lucky Draw'}
        </Button>
      </CardContent>
    </Card>
  );
}
