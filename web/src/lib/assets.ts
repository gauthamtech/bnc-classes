/**
 * Asset URLs must be relative to wherever the app is hosted, so the same
 * build works at a domain root or dropped in any subfolder. BASE_URL is
 * './' from the Vite config, and the document URL never changes because
 * routing uses the hash.
 */
const base = import.meta.env.BASE_URL;

export const LOGO = `${base}brand/bnc-logo.png`;
