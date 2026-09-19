const stamp = () => new Date().toISOString();

export const logger = {
  info: (...a) => console.log(`[${stamp()}] INFO `, ...a),
  warn: (...a) => console.warn(`[${stamp()}] WARN `, ...a),
  error: (...a) => console.error(`[${stamp()}] ERROR`, ...a),
  debug: (...a) => {
    if (process.env.NODE_ENV !== 'production') console.debug(`[${stamp()}] DEBUG`, ...a);
  },
};