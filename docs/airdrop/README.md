# MYRIA Airdrop

## 1. Early adopter
### Verify Leaderboard Snapshoot

- Download database

```bash
https://github.com/myriadsocial/myriad-api/releases/download/1.0.0-beta3/01.15.2022_myriad-db-0.dump
```

- Restore database

```bash
mongorestore -u=<username> -p=<password> -d=myriad --archive=./01.15.2022_myriad-db-0.dump
```

On restoring data, you will see this error that showed a duplicate data, but this will not affect the rank.

```bash
continuing through error: E11000 duplicate key error collection: myriad.votes index: uniqueVoteIndex dup key: { userId: "0x22ab91aba7e6f8937930da2b42147b426301e8dbafdfa006330afe33e36e925b", type: "post", referenceId: "61dfc228d376da001d0eeebf" }
```

- Run query

```bash
db.users.find({},{_id: 1, username: 1, name: 1, profilePictureURL: 1, "metric.totalKudos": 1}).sort({"metric.totalKudos": -1}).limit(500)
```

- Result

[Leaderboard Snapshot](./leaderboard-snapshot.md)

### Distribution

- Run command
```bash
yarn install && yarn airdrop
```

- Result

[Leaderboard Distribution](./leaderboard-distribution.md)
