FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    tinc iproute2 python3 python3-cryptography jq curl iperf3 ca-certificates unzip openssl uuid-runtime procps \
    && mkdir -p /usr/local/share/xray /usr/local/etc/xray /etc/vless-mesh /etc/tinc/mesh \
    && curl -L -o /tmp/xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip \
    && unzip /tmp/xray.zip -d /tmp/xray \
    && install -m755 /tmp/xray/xray /usr/local/bin/xray \
    && install -m644 /tmp/xray/geoip.dat /usr/local/share/xray/geoip.dat \
    && install -m644 /tmp/xray/geosite.dat /usr/local/share/xray/geosite.dat \
    && rm -rf /var/lib/apt/lists/* /tmp/xray /tmp/xray.zip

COPY setup-server /usr/local/bin/setup-server
RUN chmod +x /usr/local/bin/setup-server

COPY docker-server/entry.sh /entry.sh
RUN chmod +x /entry.sh

ENTRYPOINT ["/entry.sh"]
