// Sur le primaire
use Universite
db.etudiants.insertOne({"N°": 19, Matricule: "KIA-TEST-001", "Noms et prenoms": "TEST REPLICATION", SEXE: "F"})
db.etudiants.updateOne({Matricule: "KIA-TEST-001"}, {$set: {"Noms et prenoms": "TEST MODIFIE"}})
db.etudiants.deleteOne({Matricule: "KIA-TEST-001"})

// Sur le secondaire (mongosh --port 27017)
db.getMongo().setReadPref("secondary")
use Universite
db.etudiants.countDocuments()
db.etudiants.find({Matricule: "KIA-TEST-001"})