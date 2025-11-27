# VLESS Mesh (tinc поверх Reality)

Повторяемая L2 mesh‑сеть: **tinc** передаёт кадры Ethernet, а транспорт — **VLESS + Reality** (Xray). Узлы общаются напрямую (peer‑to‑peer); если прямой путь недоступен, трафик может идти через любой доступный пир.

Протестировано в LXD (Ubuntu 24.04), но скрипты подходят для Debian/Ubuntu‑подобных систем.

## Компоненты
- **tinc**: режим switch, статическая /24, автоматические P2P‑линки.
- **xray-core**: VLESS по TCP + Reality; у каждого узла свой Reality‑ключ и shortId; общий mesh UUID.
- **Реестр** (на сервере): простой HTTP API для раздачи host‑файлов и Reality‑данных; доступ по токену.
- **mesh-refresh** (на клиентах): systemd‑таймер, раз в 2 минуты подтягивает peers и перезаписывает конфиги.

## Что ставят скрипты
- Пакеты: `tinc`, `curl`, `jq`, `python3`, `python3-cryptography`, `xray-core` (через официальный инсталлер, если нет).
- Сервисы: `tinc@mesh`, `xray.service`, `mesh-registry.service` (сервер), `mesh-refresh.timer` (клиенты).

## Сеть и порты
- Виртуальная подсеть tinc: `/24` на выбор (пример 10.10.0.0/24).
- tinc TCP listen: по умолчанию `6060` (локально, трафик уходит через xray).
- xray VLESS listen: по умолчанию `443` на каждом узле.
- Reality dest/SNI: по умолчанию `www.microsoft.com:443` (меняется флагом `--reality-dest`).
- Реестр HTTP: по умолчанию `9000` на сервере.

## Быстрый запуск (с нуля)
1) **Сервер** (имеет доступный IP/DNS):
```bash
sudo ./setup-server --mesh-ip 10.10.0.1 --pub-addr <PUBLIC_IP>
```
В выводе будут: Mesh UUID, Reality public key + shortId, токен реестра, путь к host‑файлу `/etc/tinc/mesh/hosts/server`.

2) **Каждый клиент** (своё mesh‑IP и публичный адрес):
```bash
sudo ./setup-client \
  --server-addr <PUBLIC_IP> \
  --mesh-ip 10.10.0.X \
  --pub-addr <THIS_PUBLIC_IP_OR_DNS> \
  --token <TOKEN_FROM_SERVER>
```
Команда сама зарегистрирует узел, скачает peers, построит per‑peer VLESS и host‑файлы tinc, запустит xray/tinc/mesh-refresh.

3) **Проверка**
```bash
ping 10.10.0.1      # клиент → сервер
ping 10.10.0.4      # клиент → клиент (P2P поверх VLESS)
```

## Параметры
### setup-server
- `--mesh-ip` (обязательно) Mesh /24 IP сервера
- `--pub-addr` (обязательно) Публичный IP/DNS сервера
- `--vless-port` (443)
- `--tinc-port` (6060)
- `--mtu` (1400)
- `--reality-dest` (www.microsoft.com:443)
- `--mesh-uuid` (необязательно)
- `--registry-port` (9000)
- `--registry-token` (необязательно)

### setup-client
- `--server-addr` (обязательно) IP/DNS сервера
- `--mesh-ip` (обязательно) Статический mesh /24 IP узла
- `--token` (обязательно) Токен реестра
- `--pub-addr` Публичный/DNS адрес этого узла (по умолчанию первый IP интерфейса)
- `--name` Имя узла (tinc), по умолчанию hostname
- `--vless-port` (443)
- `--tinc-port` (6060)
- `--fw-base` Базовый dokodemo‑порт, на каждый пир +1 (7000)
- `--mtu` (1400)
- `--mesh-uuid` Задать UUID mesh
- `--registry-port` (9000)
- `--reality-dest` SNI/dest для Reality
- `--refresh-only` Только обновить конфиги из реестра (без установки пакетов и регистрации)

## Файлы
- `/etc/vless-mesh/token` (сервер): токен реестра
- `/etc/vless-mesh/peers.json`: список пиров
- `/etc/vless-mesh/self.json`: собственные Reality‑ключи узла
- `/etc/vless-mesh/config.json`: сохранённые параметры клиента (используются при refresh)
- `/etc/tinc/mesh/hosts/*`: host‑файлы, переписанные на 127.0.0.1:<dokodemo>
- `/usr/local/etc/xray/config.json`: сгенерированный конфиг xray

## Добавление нового клиента
Запустите `setup-client` на новом узле с его mesh‑IP, pub‑addr и токеном. Остальные узлы подтянут его автоматически через `mesh-refresh` (или вручную `setup-client --refresh-only`).

## Ручное обновление peers
```bash
sudo ./setup-client --refresh-only
```
Использует сохранённые config/self, не переустанавливает пакеты.

## Типичные проблемы
- **Unknown identity / ping не идёт**: обновите хосты `--refresh-only` или повторно запустите `setup-client`.
- **Reality auth failed**: сверить public key/shortId сервера в `/etc/vless-mesh/peers.json`; перезапустить клиент с корректным токеном и адресом.
- **Блокируются порты**: VLESS слушает TCP 443, реестр — 9000.
- **Смена публичного IP**: запустить `setup-client` с новым `--pub-addr` или правкой `config.json` + `--refresh-only`.

## Очистка
```bash
sudo systemctl disable --now xray tinc@mesh mesh-refresh.timer mesh-registry.service 2>/dev/null
sudo rm -rf /etc/tinc/mesh /etc/vless-mesh /usr/local/etc/xray
```

## Безопасность
- Reality даёт TLS‑маскировку; у каждого узла своя пара ключ/shortId.
- Реестр защищён только токеном — храните его в секрете.
- Шифрование tinc не отключено: получается двойное шифрование поверх Reality.
