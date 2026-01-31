export const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '[REDACTED]';
  return `${name.slice(0, 2)}***@${domain}`;
};
