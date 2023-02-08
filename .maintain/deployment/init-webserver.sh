#!/bin/bash

if ! [ -x "$(command -v docker-compose)" ]; then
  echo 'Error: docker-compose is not installed.' >&2
  exit 1
fi

read -p "Domain: (api.example.com) " domains
read -p "Email: (me@example.com) " email
# domains=api.wibu.com
# email="me@wibu.com"  # Adding a valid address is strongly recommended
staging=1 # Set to 1 if you're testing your setup to avoid hitting request limits
nginx_data_path="./.local/nginx"
certbot_data_path="./.local/certbot"
rsa_key_size=4096

if [ -d "$nginx_data_path" ]; then
  read -p "Existing data found for $domains. Continue and replace existing nginx configuration? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Copying nginx configuration"
mkdir -p $nginx_data_path
cp ./.maintain/deployment/nginx.conf $nginx_data_path/nginx.conf
sed -i '' "s~api.example.com~${domains}~" $nginx_data_path/nginx.conf

echo "### Restarting nginx ..."
docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env up --force-recreate --no-deps -d nginx
echo

if [ -d "$certbot_data_path" ]; then
  read -p "Existing data found for $domains. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

if [ ! -e "$certbot_data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$certbot_data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$certbot_data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$certbot_data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$certbot_data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $domains ..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$certbot_data_path/conf/live/$domains"
docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Restarting nginx ..."
docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env up --force-recreate --no-deps -d nginx
echo

echo "### Deleting dummy certificate for $domains ..."
docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reloading nginx ..."
docker-compose -f ./.maintain/deployment/docker-compose.yml --env-file ./.env exec nginx nginx -s reload
