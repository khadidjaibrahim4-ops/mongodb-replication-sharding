// Sur mongosh --port 27017
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "127.0.0.1:27017" },
    { _id: 1, host: "127.0.0.1:27018" }
  ]
})

// Sur mongosh --port 26050
rs.initiate({_id: "cfg", configsvr: true, members: [{_id: 0, host: "127.0.0.1:26050"}]})

// Sur mongosh --port 27101
rs.initiate({_id: "shardF", members: [{_id: 0, host: "127.0.0.1:27101"}]})

// Sur mongosh --port 27200 (mongos)
sh.addShard("shardF/127.0.0.1:27101")
sh.enableSharding("Universite")
sh.shardCollection("Universite.etudiants", {SEXE: 1})