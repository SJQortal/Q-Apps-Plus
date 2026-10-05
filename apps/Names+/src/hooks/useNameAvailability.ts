import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Availability } from '../interfaces';

/** Core's Name.MIN_NAME_SIZE / MAX_NAME_SIZE. */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 40;

export function nameLengthProblem(name: string): 'short' | 'long' | null {
  const length = name.trim().length;
  if (length === 0) return null;
  if (length < NAME_MIN_LENGTH) return 'short';
  if (length > NAME_MAX_LENGTH) return 'long';
  return null;
}

export function nameLengthMessage(t: TFunction, name: string): string {
  const problem = nameLengthProblem(name);
  if (problem === 'short') {
    return t('core:new_name.name_too_short', {
      min: NAME_MIN_LENGTH,
      postProcess: 'capitalizeFirstChar',
    });
  }
  if (problem === 'long') {
    return t('core:new_name.name_too_long', {
      max: NAME_MAX_LENGTH,
      postProcess: 'capitalizeFirstChar',
    });
  }
  return '';
}

/**
 * Asks the node whether a name is taken: the same GET /names/{name} the
 * original app uses. Core answers "name unknown" for a free name.
 */
export async function checkNameAvailability(name: string): Promise<Availability> {
  const res = await fetch(`/names/${encodeURIComponent(name)}`);
  const data = await res.json();
  if (data?.message === 'name unknown' || data?.error) return Availability.AVAILABLE;
  return Availability.NOT_AVAILABLE;
}

/**
 * Debounced availability for the name the user is typing. Names outside
 * Core's length limits are INVALID without a request, and an answer that
 * arrives after the name changed again is ignored.
 */
export function useNameAvailability(name: string, delayMs = 500): Availability {
  const [availability, setAvailability] = useState<Availability>(Availability.NULL);
  const ticketRef = useRef(0);

  useEffect(() => {
    const trimmed = name.trim();
    const ticket = ++ticketRef.current;
    if (!trimmed) {
      setAvailability(Availability.NULL);
      return;
    }
    if (nameLengthProblem(trimmed)) {
      setAvailability(Availability.INVALID);
      return;
    }
    setAvailability(Availability.LOADING);
    const handle = setTimeout(async () => {
      let result: Availability;
      try {
        result = await checkNameAvailability(trimmed);
      } catch (error) {
        // Same fallback as the original app: a failed check doesn't block the user;
        // Core still rejects a taken name.
        console.error(error);
        result = Availability.AVAILABLE;
      }
      if (ticketRef.current === ticket) setAvailability(result);
    }, delayMs);
    return () => clearTimeout(handle);
  }, [name, delayMs]);

  return availability;
}
