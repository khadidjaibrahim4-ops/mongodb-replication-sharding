# TP MongoDB, réplication et fragmentation horizontale

Travail individuel réalisé dans le cadre du Master 2 Intelligence Artificielle et Big Data (KEYCE Informatique, Yaoundé).

Ce dépôt documente la mise en place, sur une seule machine Windows, d'une réplication MongoDB (replica set) et d'une fragmentation horizontale (sharding) appliquées à une base de liste de classe.

## Objectifs

1. Mettre en place une architecture de réplication asymétrique à écriture synchrone.
2. Fragmenter horizontalement la base selon le sexe des étudiants (filles d'un côté, garçons de l'autre).
3. Tester le comportement par des opérations d'insertion, de modification et de suppression.

## Environnement

| Élément | Valeur |
|---|---|
| Système | Windows 11 |
| MongoDB Server | 8.3.17 |
| mongosh | 2.8.2 |
| MongoDB Database Tools | installés via le fichier msi, dossier `C:\Program Files\MongoDB\Tools\100\bin` |

## Architecture

Deux ensembles d'instances indépendants cohabitent sur la machine, chacun avec ses propres ports et dossiers de données.

| Rôle | Port | Dossier de données | Replica set |
|---|---|---|---|
| Membre 1 de `rs0` | 27017 | `C:\mongo\data1` | rs0 |
| Membre 2 de `rs0` | 27018 | `C:\mongo\data2` | rs0 |
| Config server | 26050 | `C:\mongo\config1` | cfg |
| shardF (filles) | 27101 | `C:\mongo\shardF` | shardF |
| mongos (routeur) | 27200 | aucun | non applicable |
| shardM (garçons) | 27102 | `C:\mongo\shardM` | shardM, prévu avec le groupe |

## Partie 1. Réplication

### Principe

Un replica set est un groupe d'instances `mongod` qui conservent les mêmes données. Un membre est primaire et reçoit les écritures. Les autres sont secondaires et copient les opérations depuis l'oplog du primaire. L'architecture est donc asymétrique.

### Mise en œuvre

1. Création de deux instances sur les ports 27017 et 27018, avec `--replSet rs0` et un `--dbpath` distinct pour chacune.
2. Initialisation du replica set avec `rs.initiate` depuis mongosh.
3. Contrôle de l'état avec `rs.status()`. Le membre 27018 est devenu primaire et le membre 27017 secondaire, tous deux avec `health 1`.
4. Importation de la liste de classe avec `mongoimport` dans la base `Universite`, collection `etudiants`, soit 18 documents (9 filles et 9 garçons).

Les en-têtes d'origine du CSV ont été conservés (`N°`, `Matricule`, `Noms et prenoms`, `SEXE`). Les requêtes utilisent donc des guillemets pour les champs contenant des espaces ou un symbole.

### Écriture synchrone ou asynchrone

Le mécanisme interne de MongoDB est asynchrone, car le secondaire applique l'oplog après coup. Le comportement vu par le client dépend du write concern. Depuis MongoDB 5.0 la valeur par défaut est `w: "majority"`. Avec deux membres, la majorité est de 2, donc le primaire attend la confirmation du secondaire avant de répondre. Pour rendre la synchronisation explicite, on peut utiliser `w: 2`.

```js
db.etudiants.insertOne(
  {"N°": 20, Matricule: "KIA-TEST-002", "Noms et prenoms": "TEST SYNCHRONE", SEXE: "M"},
  {writeConcern: {w: 2, wtimeout: 5000}}
)
```

### Tests de réplication

Une insertion, une modification et une suppression effectuées sur le primaire ont été observées sur le secondaire avec le même `_id`. Le compteur est passé de 18 à 19 après l'insertion, puis est revenu à 18 après la suppression. Les scripts sont dans `scripts/tests_replication.js`.

### Limite observée

Avec seulement deux membres, un primaire ne peut être élu que si les deux instances sont démarrées. Quand l'une est arrêtée, l'autre reste secondaire et les logs affichent `No primary exists currently`. Pour une vraie tolérance aux pannes, il faut un troisième membre ou un arbitre, ce qui correspond aussi à l'architecture « un maître et deux esclaves » de l'énoncé.

## Partie 2. Fragmentation horizontale

### Principe

Fragmenter une base consiste à la découper en fragments répartis sur plusieurs sites. Une fragmentation correcte respecte trois règles.

- Complétude. Chaque donnée se retrouve dans au moins un fragment.
- Reconstruction. La base d'origine se retrouve par union des fragments (fragmentation horizontale).
- Disjonction. Une donnée n'appartient qu'à un seul fragment.

La fragmentation horizontale découpe par lignes selon un prédicat, tous les fragments gardant les mêmes colonnes. Ici, le fragment F contient `SEXE = "F"` et le fragment M contient `SEXE = "M"`.

### Équivalent MongoDB

MongoDB fragmente par sharding. Les composants sont les suivants.

- **Shard**, une instance qui stocke un fragment. Chaque shard doit être un replica set, même avec un seul membre.
- **Config server**, qui garde la carte de répartition des données.
- **mongos**, le routeur par lequel passent toutes les requêtes.
- **Clé de shard**, ici `SEXE`.
- **Zones**, qui associent une plage de valeurs de la clé à un shard précis.

Réplication et fragmentation sont indépendantes. La fragmentation répartit les données entre les shards, et la réplication copie chaque fragment sur plusieurs membres. Chaque shard étant un replica set, on obtient une réplication fragmentée.

### Étapes réalisées

1. Démarrage et initialisation du config server (port 26050, replica set `cfg`).
2. Démarrage et initialisation de shardF (port 27101, replica set `shardF`).
3. Démarrage de mongos (port 27200) et ajout du shard avec `sh.addShard("shardF/127.0.0.1:27101")`.
4. Insertion de documents via mongos, ce qui a placé la base `Universite` sur shardF.
5. Déclaration de la collection shardée avec la clé `SEXE`.

```js
sh.enableSharding("Universite")
sh.shardCollection("Universite.etudiants", {SEXE: 1})
```

`sh.status()` affiche ensuite `Universite.etudiants` avec `shardKey: { SEXE: 1 }` et un chunk unique sur shardF, ce qui est normal avec un seul shard.

### Reste à faire, avec le groupe

1. Démarrer shardM (port 27102) et l'ajouter avec `sh.addShard`.
2. Créer les zones ZoneF et ZoneM et associer chaque shard à sa zone.
3. Définir les plages, `F` vers ZoneF et `M` vers ZoneM.
4. Réimporter les 18 étudiants via mongos et vérifier 9 documents par shard avec `db.etudiants.getShardDistribution()`.
5. Mettre les machines en réseau, comme demandé dans l'énoncé.

### Choix de la clé de shard

`SEXE` répond à la consigne du TP, mais ce serait un mauvais choix en production. Cette clé n'a que deux valeurs, ce qui limite le système à deux chunks et peut déséquilibrer les shards si la répartition F et M est inégale.

## Problèmes rencontrés et solutions

| Problème | Cause | Solution |
|---|---|---|
| `isWritablePrimary` renvoie `false` | La session était connectée au membre secondaire | Se connecter avec l'URI du replica set, ou vérifier avec `rs.status()` |
| `mongoimport` non reconnu | Les Database Tools sont séparés de MongoDB Server | Installer le msi, puis utiliser le chemin complet de l'exécutable |
| `no such command: enableSharding` | Commande tapée sur un shard et non sur mongos | Se connecter à mongos avec `mongosh --port 27200` |
| `No primary exists currently` | Replica set à deux membres dont un est arrêté | Redémarrer l'instance manquante |

## Organisation du dépôt

```
mongodb-replication-sharding/
  README.md
  scripts/
    replica_set.bat
    sharding.bat
    init_replica_set.js
    tests_replication.js
  docs/
    captures d'écran
```

## Données

Le fichier CSV de la classe n'est pas publié, car il contient des données personnelles. Pour reproduire le TP, créer un fichier `etudiants_clean.csv` avec les colonnes `N°`, `Matricule`, `Noms et prenoms` et `SEXE`, puis lancer l'importation.

```
"C:\Program Files\MongoDB\Tools\100\bin\mongoimport.exe" --uri="mongodb://127.0.0.1:27017,127.0.0.1:27018/?replicaSet=rs0" --db=Universite --collection=etudiants --type=csv --headerline --file="C:\mongo\etudiants_clean.csv"
```

## Auteure

Salle Adji Khadidja, Master 2 IABD, KEYCE Informatique, Yaoundé.
