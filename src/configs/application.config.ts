export const application = {
  port: +(process.env.PORT ?? 3000),
  host: process.env.HOST ?? 'localhost',
};
