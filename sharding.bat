@echo off
mkdir C:\mongo\config1 C:\mongo\shardF
start "config server 26050" "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --configsvr --replSet cfg --port 26050 --dbpath C:\mongo\config1 --bind_ip 127.0.0.1
start "shardF 27101" "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --shardsvr --replSet shardF --port 27101 --dbpath C:\mongo\shardF --bind_ip 127.0.0.1
start "mongos 27200" "C:\Program Files\MongoDB\Server\8.3\bin\mongos.exe" --configdb cfg/127.0.0.1:26050 --port 27200 --bind_ip 127.0.0.1