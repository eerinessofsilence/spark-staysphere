'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { pill } from '@/lib/ui';
import { addSpinnerFrameAction } from './actions';

/**
 * Adds a frame of the orbit to the hotel's key angles. The building is turned
 * with a slider rather than a drag here: this is picking one number out of
 * 160, and the markup canvas next to it already owns dragging.
 */
export function AddFrameButton({
  frames,
  keyAngles,
}: {
  frames: Array<{ index: number; imageUrl: string }>;
  keyAngles: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [frame, setFrame] = React.useState(() => firstFreeFrame(frames, keyAngles));
  const [pending, startTransition] = React.useTransition();

  const taken = keyAngles.includes(frame);
  const preview = frames.find((candidate) => candidate.index === frame);

  function add() {
    startTransition(async () => {
      const result = await addSpinnerFrameAction(frame);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Frame ${frame} added.`);
      router.push(`/admin/content/spinner/markup?frame=${frame}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFrame(firstFreeFrame(frames, keyAngles));
          setOpen(true);
        }}
        className={pill('primary')}
      >
        <PlusIcon className="size-4" aria-hidden="true" />
        Add frame
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a frame">
        <p className="text-sm text-muted-foreground">
          Turn the building to the angle you want to mark up. That frame then carries zones, and the guest&apos;s
          arrows stop on it.
        </p>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.imageUrl}
            alt=""
            className="mt-4 aspect-video w-full rounded-[14px] bg-stone object-cover"
          />
        ) : null}

        <label className="mt-4 block text-sm font-medium" htmlFor="add-frame-slider">
          Frame {frame}
          {taken ? <span className="ml-2 text-xs font-normal text-muted-foreground">already added</span> : null}
        </label>
        <input
          id="add-frame-slider"
          type="range"
          min={0}
          max={frames.length - 1}
          value={frame}
          onChange={(event) => setFrame(Number(event.target.value))}
          className="mt-2 w-full accent-primary"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={pill('secondary')} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className={pill('primary')} disabled={taken || pending} onClick={add}>
            {pending ? 'Adding…' : 'Add frame'}
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Opens on a frame that is not a key angle yet, so the primary action is never born disabled. */
function firstFreeFrame(frames: Array<{ index: number }>, keyAngles: number[]): number {
  return frames.find((frame) => !keyAngles.includes(frame.index))?.index ?? 0;
}
