/**
 * Signals motion artwork covers that their layer is covered by an overlay
 * (detail / now playing / settings / quota modal) so they release their video
 * players. Android Modals are separate Windows: the focused card underneath
 * never receives a view-level blur, so without this signal its motion video
 * would keep decoding invisibly behind the modal.
 *
 * The default is `false` (not suspended). Modal subtrees are JSX siblings of
 * the provider-wrapped base layer, so they fall back to the default and their
 * own covers keep playing.
 */

import React, { createContext, useContext } from 'react';

const MotionSuspenseContext = createContext<boolean>(false);

export function MotionSuspenseProvider({
  suspended,
  children,
}: Readonly<{
  suspended: boolean;
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <MotionSuspenseContext.Provider value={suspended}>
      {children}
    </MotionSuspenseContext.Provider>
  );
}

export function useMotionSuspended(): boolean {
  return useContext(MotionSuspenseContext);
}
