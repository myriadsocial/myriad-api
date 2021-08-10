export const token = {
  secretKey: process.env.TOKEN_SECRET_KEY ?? '',
  expiresIn: process.env.TOKEN_EXPIRES_IN ?? '36000',
};

export const refresh = {
  secretKey: process.env.REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '216000',
};
