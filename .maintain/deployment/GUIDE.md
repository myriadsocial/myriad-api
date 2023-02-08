1. ```git clone https://github.com/myriadsocial/myriad-api.git```
2. ```cp ./.maintain/deployment/.env-template ./.env```
3. ```vim .env```
4. configure .env
5. ```docker compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env --profile webserver up -d```
6. ```chown -R 1001:1001 ./.local``` 
7. ```docker compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env run --rm db_migration --rebuild --environment testnet```
8. ```./.maintain/deployment/init-webserver.sh```
