# VLESS Mesh (tinc поверх Reality)

L2 mesh: **tinc** передаёт кадры Ethernet, транспорт — **VLESS + Reality** (Xray). Поддерживает P2P, NAT-клиентов в режиме dial-only с автоподбором пиров через iperf3, а для узлов в одной LAN строит прямой tinc без VLESS.

Проверено на Ubuntu 24.04 (LXD), но рассчитано на Debian/Ubuntu-подобные системы.

## Возможности
- L2 (switch), статическая /24.
- Шифрование: VLESS TCP + Reality на каждом узле.
- NAT-friendly: `--dial-only` + выбор лучших пиров по iperf3.
- LAN-aware: если пир в той же приватной /24, tinc подключается напрямую (нет VLESS оверхеда).
- Реестр пиров на сервере (HTTP, токен), авто-refresh на клиентах.
- Опционально: перепривязка kubelet `--node-ip` к mesh-IP на Kubernetes-нодах.

## Что ставят скрипты
- Пакеты: `tinc`, `curl`, `jq`, `python3`, `python3-cryptography`, `iperf3`, `ipset`, `iptables`, `xray-core` (если нет — ставится).
- Сервисы: `tinc@mesh`, `xray.service`, `mesh-registry.service` (сервер), `mesh-refresh.timer` (клиенты), `iperf3-mesh.service` (принимающие).

## Порты
- Виртуальная сеть: /24 (пример 10.10.0.0/24).
- tinc TCP: 6060 (локально при работе через VLESS).
- VLESS: 443.
- Reality dest/SNI: www.microsoft.com:443 (по умолчанию).
- Реестр: 9000.
- iperf3: 5201 (для теста скорости).

## Быстрый старт
1) Сервер (есть публичный IP/DNS):
```
sudo ./setup-server --mesh-ip 10.10.0.1 --pub-addr <SERVER_IP>
# или авто mesh IP (10.10.0.<последний_октет_хост_IP>):
sudo ./setup-server --pub-addr <SERVER_IP>
```
В выводе: Mesh UUID, Reality key/shortId, токен, host-файл.

2) Клиенты:
Обычный (принимает входящие):
```
sudo ./setup-client --server-addr <SERVER_IP> \
  --pub-addr <THIS_PUBLIC> \
  --token <TOKEN>
```
Если порт реестра недоступен или сервер недостижим напрямую, можно указать адрес любого существующего узла mesh в `--server-addr`: трафик не-пиров на `:443` по умолчанию ретранслируется к серверу, а `setup-client` попробует подключиться к реестру через порт `443`, если `9000` недоступен.
NAT dial-only (только исходящие, выбор лучших пиров):
```
sudo ./setup-client --server-addr <SERVER_IP> \
  --pub-addr <THIS_LAN_OR_PUBLIC> \
  --token <TOKEN> --dial-only --top-peers 2
```
`--mesh-ip` можно не указывать (или указать `auto`) — тогда берётся `10.10.0.<последний_октет>` от хост-IP.
Если пир в той же приватной /24, соединение пойдёт напрямую через tinc без VLESS.

3) Проверка
```
ping 10.10.0.1
ping 10.10.0.4
```
`ss -tnp | grep 443` покажет VLESS-сокеты; для LAN-пиров будет видно прямое tinc TCP на их LAN-IP:6060.

## Параметры
### setup-server
- `--mesh-ip` (по умолчанию авто от хост-IP; поддерживает `auto`), `--pub-addr` (обязательно)
- `--vless-port` 443, `--tinc-port` 6060, `--mtu` 1400
- `--reality-dest` (SNI), `--mesh-uuid`, `--registry-port` 9000, `--registry-token`
- `--k8s-clients` / `--no-k8s-clients` включение/отключение установки DaemonSet клиентов (авто, если есть kubectl)
- `--no-kubelet-node-ip` не менять kubelet `--node-ip` на mesh-IP

### setup-client
- `--server-addr`, `--token` — обязательные; `--mesh-ip` по умолчанию авто от хост-IP
- `--pub-addr`, `--name`, `--vless-port`, `--tinc-port`, `--fw-base`, `--mtu`
- `--mesh-uuid`, `--registry-port`, `--reality-dest`
- `--dial-only` — узел за NAT, только исходящие туннели
- `--top-peers N` — сколько лучших пиров оставить (iperf3), по умолчанию 2
- `--relay-server` / `--no-relay-server` — ретрансляция не-пиров на `:443` к серверу (по умолчанию включено)
- `--relay-port` — локальный порт ретрансляции (по умолчанию 4443)
- `--refresh-only` — обновить из сохранённого конфига
- `--deploy` host|docker|compose|k8s (по умолчанию host)
- `--no-kubelet-node-ip` не менять kubelet `--node-ip` на mesh-IP (только host-режим)

## Внутри
- Клиент регистрируется в реестре, получает список пиров.
- dial-only: iperf3 к принимающим, оставляет top N; строит VLESS/tinc только к ним.
- LAN-aware: если пир в той же приватной /24, tinc подключается напрямую к его `tinc_port`, минуя VLESS.
- mesh-refresh каждые 2 минуты запускает `setup-client --refresh-only` (с iperf-подбором для dial-only).

## Обновление
```
sudo ./setup-client --refresh-only
```
Использует сохранённые config/self, снова тянет реестр, перегенерирует xray/tinc.

## Добавить новый клиент
Запустите `setup-client` на новом узле с его mesh-IP (или `auto`), pub-addr и токеном. Остальные увидят его при следующем refresh.

## Kubernetes: авто-клиенты
Если `setup-server` запускается на control-plane с `kubectl`, он создаёт namespace `vless-mesh`, секрет/configmap и применяет DaemonSet на всех не-control-plane узлах. По умолчанию также выставляет kubelet `--node-ip` на mesh-IP (отключается через `--no-kubelet-node-ip`). Для образа укажите `--image-registry registry:443/`.

## Устранение неполадок
- Нет ping / unknown identity: `--refresh-only`, проверьте токен/UUID.
- Reality auth fail: сверить public key/shortId сервера в `/etc/vless-mesh/peers.json`.
- Порты: VLESS 443, реестр 9000, iperf3 5201; для NAT узлов нужен исходящий 443.
- Смена pub/LAN IP: перезапустить с новым `--pub-addr` или отредактировать config.json + `--refresh-only`.

## Безопасность
- Reality: маскировка под TLS, у каждого узла свой key/shortId.
- Токен реестра хранить в секрете.
- tinc шифрование не отключено (двойное шифрование поверх Reality для нелокальных путей).
