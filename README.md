# vless-mesh

Автоматизированный запуск L2 mesh (tinc) поверх транспорта VLESS Reality.

## Быстрый старт
1) На серверном узле (с белым или доступным IP) выполните:
```
sudo ./setup-server --mesh-ip 10.10.0.1 --pub-addr <SERVER_PUBLIC_IP>
```
Скрипт выведет `Mesh UUID` и `token`, запустит реестр на http://<SERVER_PUBLIC_IP>:9000.

2) На каждом клиенте выполните одну команду (с указанием своего статического mesh IP и публичного адреса):
```
sudo ./setup-client --server-addr <SERVER_PUBLIC_IP> \
  --mesh-ip 10.10.0.X --pub-addr <THIS_PUBLIC_IP> \
  --token <TOKEN_FROM_SERVER>
```

Скрипт сам зарегистрирует узел в реестре, получит сведения обо всех узлах, настроит xray (VLESS Reality) и tinc в режиме L2 switch. Все клиенты получают прямые p2p-соединения поверх VLESS; при недоступности p2p остаётся путь через другие узлы.

## Файлы
- `setup-server` — установка сервера, генерация Reality-ключей, mesh UUID, запуск реестра и tinc/xray.
- `setup-client` — установка клиента, регистрация в реестре, генерация/сохранение Reality-ключей и tinc/xray-конфигов для всех пиров.
- Реестр: `/etc/vless-mesh/peers.json`, токен в `/etc/vless-mesh/token` (сервер), кеш клиента `/etc/vless-mesh/self.json`.

## Примечания
- Транспорт: VLESS + Reality (TCP) с общим UUID для всей mesh. Каждый узел имеет собственный Reality keypair и shortId.
- Туннель tinc работает только через VLESS (ConnectTo -> локальные dokodemo порты -> VLESS outbounds). Шифрование tinc не отключалось, так что поверх Reality получается двойное шифрование.
- При повторном запуске `setup-client` ключи сохраняются (файл self.json), можно добавить новых клиентов без переподписания старых.
