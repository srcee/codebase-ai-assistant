#!/bin/sh
set -eu

token_file=/run/api-token/api-token.secret
waited=0
until [ -s "$token_file" ]; do
  if [ "$waited" -ge 600 ]; then
    echo "web: the API did not create its token file; check 'docker compose logs api'" >&2
    exit 1
  fi
  if [ $((waited % 15)) -eq 0 ]; then
    echo "web: waiting for the API to start"
  fi
  sleep 1
  waited=$((waited + 1))
done

token=$(tr -d '\r\n' < "$token_file")
case "$token" in
  '' | *[!A-Za-z0-9_-]*)
    echo "web: the API token file is malformed" >&2
    exit 1
    ;;
esac

umask 077
sed "s|__API_TOKEN__|$token|" /etc/caa/nginx.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
