FROM postgres:17-alpine

RUN apk add --no-cache curl jq
COPY --chmod=755 backup.sh /usr/local/bin/dailyflow-backup

USER postgres
ENTRYPOINT ["/usr/local/bin/dailyflow-backup"]
