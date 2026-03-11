interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getVapidConfig(): VapidConfig {
  return {
    subject: getRequiredEnv("VAPID_SUBJECT"),
    publicKey: getRequiredEnv("VAPID_PUBLIC_KEY"),
    privateKey: getRequiredEnv("VAPID_PRIVATE_KEY"),
  };
}

export function getVapidPublicKey() {
  return getRequiredEnv("VAPID_PUBLIC_KEY");
}
