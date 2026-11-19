@echo off
mkdir C:\mongo\data1 C:\mongo\data2
start "mongod 27017" "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --replSet rs0 --port 27017 --dbpath C:\mongo\data1 --bind_ip 127.0.0.1
start "mongod 27018" "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --replSet rs0 --port 27018 --dbpath C:\mongo\data2 --bind_ip 127.0.0.1