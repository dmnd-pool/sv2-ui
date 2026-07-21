/**
 * The pool endpoint a miner points hardware at. Verified from the production
 * dashboard bundle (`proxy.dmnd.work:3456`); the design mock shows a placeholder
 * host instead. Shared by the home connect-workers card and the account setup connect step.
 */
export const POOL_URL = 'stratum+tcp://proxy.dmnd.work:3456';

/** The miner username on DMND is free-form, so this is guidance, not a value. */
export const POOL_USERNAME_HINT = 'Any value or leave empty';

/**
 * The setup tutorial / learning resource. Empty until DMND provides a real URL, so
 * every caller renders the prompt without a link rather than pointing at a page that
 * would not resolve. Fill this in once the URL exists and the links light up.
 */
export const SETUP_TUTORIAL_URL = '';
