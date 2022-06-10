export function generateObjectId(): string {
  const ObjectID = require('bson-objectid');
  const timestamp = new Date().getTime();

  return ObjectID(timestamp).toString();
}
