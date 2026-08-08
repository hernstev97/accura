export const tactileSpring = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.55 };

export const spatialSpring = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.75 };

export const emphasizedTransition = { duration: 0.28, ease: [0.2, 0, 0, 1] as const };

export const longTransition = { duration: 0.36, ease: [0.2, 0, 0, 1] as const };
