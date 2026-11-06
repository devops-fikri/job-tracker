#!/bin/sh
# Nightly pg_dump at BACKUP_HOUR (local time, TZ env), keeping the newest BACKUP_KEEP dumps.
set -eu
HOUR="${BACKUP_HOUR:-3}"
KEEP="${BACKUP_KEEP:-14}"
DIR=/backups

dump() {
  f="$DIR/jobtracker-$(date +%Y%m%d-%H%M).dump"
  if pg_dump -Fc -f "$f.part"; then
    mv "$f.part" "$f"
    echo "$(date -Iseconds) backup ok: $f ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.part"
    echo "$(date -Iseconds) backup FAILED" >&2
  fi
  ls -1t "$DIR"/jobtracker-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
}

[ "${1:-}" = "now" ] && { dump; exit 0; }

echo "backup scheduler started: daily at ${HOUR}:00 $(date +%Z), keeping $KEEP"
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) ${HOUR}:00:00" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  dump
done
