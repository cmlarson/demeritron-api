'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const port = process.env.PORT || 3000;
const router = express.Router(); 
const apiKey = process.env.API_KEY;

// Graph DB
const dbUrl = process.env.GRAPHENEDB_URL;
const neo4j = require('neo4j');
const db = new neo4j.GraphDatabase(dbUrl);

router.get('/health', function(req, res) {
    res.json({ message: 'server is healthy' });   
});

/*
request body:
{
    "from": string,
    "to": string,
    "apiKey": string
}
*/
router.post('/demerits', function(req, res) {
    console.log(req.body);
    if (!req.body.to || !req.body.from) {
        res.status(400).json({message: "missing required field 'to' or 'from'"});
    } else if (!req.body.apiKey || req.body.apiKey != apiKey) {
        res.status(401).json({message: "invalid field 'apiKey'"})
    } else {
        const to = req.body.to.toLowerCase();
        const from = req.body.from.toLowerCase();
        try {
            // Make Cypher requests to Db server
            userExists(to).then((toUserExists) => {
                if (!toUserExists) {
                    return createUser(to);
                }
            }).then(() => {
                return userExists(from);
            }).then((fromUserExists) => {
                if (!fromUserExists) {
                    return createUser(from)
                }
            }).then(() => {
                return relationshipExists(to, from);
            }).then((relationshipExists) => {
                if (relationshipExists) {
                    console.log("updating relationship");
                    return getDemeritCount(to, from).then((currentCount) => {
                        return incrementDemeritCount(to, from, currentCount);
                    });
                } else {
                    console.log("creating relationship");
                    return createRelationship(to, from);
                }
            }).catch((error) => {
                console.log(error);
                res.status(500).json({message: "An error occurred"});
            });
            
            


            res.status(201).json({ message: "Updated DB" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Error occurred connecting to DB" });
        }
    }
});

router.get('/demerits', function(req, res) {
    // Do graph db stuff
    let users = {};
    fetchUsers().then((userData) => {
        users = userData;
    }).then(() => {
        return fetchDemerits();
    }).then((demerits) => {
        let maxDemeritsGiven = 0;
        let maxDemeritsReceived = 0;
        let maxDemeritRelationship = 0;
        let totalDemerits = 0;
        for (let user of users) {
            user.received = 0;
            user.given = 0;
            for (let demerit of demerits) {
                if (demerit.source == user.id) {
                    user.given = user.given + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.given) ? maxDemeritRelationship : user.given;
                }
                if (demerit.target == user.id) {
                    user.received = user.received + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.received) ? maxDemeritRelationship : user.received;
                }
            }
            totalDemerits = totalDemerits + user.given;
            maxDemeritsReceived = (maxDemeritsReceived > user.received) ? maxDemeritsReceived : user.received;
            maxDemeritsGiven = (maxDemeritsGiven > user.given) ? maxDemeritsGiven : user.given;
        }
        res.json({nodes: users, edges: demerits, maxDemeritsGiven: maxDemeritsGiven, maxDemeritsReceived: maxDemeritsReceived, maxDemeritRelationship: maxDemeritRelationship});
    }).catch((error) => {
        console.log(error);
        res.status(500).json({message: "An error occurred"});
    });
});

app.use('/', router);

app.listen(port);
console.log('Api running on port ' + port);

function userExists(user) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (n:Slacker) WHERE n.name = {username} RETURN n',
            params: {
                username: user,
            }
        }, function(err, results){
            if (err) {
                console.error('Error fetching user from DB:', err);
                reject();
            }
            if (results.length > 0) {
                console.log("Found user:", user);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    })
}

function createUser(user) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'CREATE (n:Slacker {name: {username}})',
            params: {
                username: user,
            }
        }, function(err, results){
            if (err) {
                console.error('Error creating new user:', err);
                reject();
            } else {
                console.log('created new user:', user);
                resolve();
            }
        });
    });
}

function relationshipExists(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (n1:Slacker)-[:GAVE_DEMERIT]->(n2:Slacker) WHERE n1.name = {fromUser} AND n2.name = {toUser} RETURN n1, n2',
            params: {
                toUser: to,
                fromUser: from
            }
        }, function(err, results){
            if (err) {
                console.error('Error looking for relationship:', err);
                reject();
            } else {
                if (results.length > 0) {
                    console.log("found relationship between:", from, to);
                    resolve(true);
                } else {
                    console.log("No relationship between:", from, to);
                    resolve(false);
                }
            }
        });
    });
}

function createRelationship(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (to:Slacker), (from:Slacker) WHERE to.name = {toUser} AND from.name = {fromUser} CREATE (from)-[:GAVE_DEMERIT {count: 1}]->(to)',
            params: {
                toUser: to,
                fromUser: from
            }
        }, function(err, results){
            if (err) {
                console.error('Error creating relationship:', err);
                reject();
            } else {
                console.log('created new relationship:', from, to);
                resolve();
            }
        });
    });
}

function getDemeritCount(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (n1:Slacker)-[r:GAVE_DEMERIT]->(n2:Slacker) WHERE n1.name = {fromUser} AND n2.name = {toUser} RETURN r.count',
            params: {
                toUser: to,
                fromUser: from
            }
        }, function(err, results){
            if (err) {
                console.error('Error getting demerit count:', err);
                reject();
            } else {
                const count = results[0]["r.count"];
                console.log('Demerits:', from, to, count);
                resolve(count);
            }
        });
    });
}

function incrementDemeritCount(to, from, currentCount) {
    return new Promise((resolve, reject) => {
        const newCount = currentCount + 1;
        db.cypher({
            query: 'MATCH (from:Slacker)-[r:GAVE_DEMERIT]->(to:Slacker) WHERE to.name = {toUser} AND from.name = {fromUser} SET r.count = {count}',
            params: {
                toUser: to,
                fromUser: from,
                count: newCount
            }
        }, function(err, results){
            if (err) {
                console.error('Error incrementing demerit count:', err);
                reject();
            } else {
                console.log('incremented demerit count:', from, to, newCount);
                resolve();
            }
        });
    });
}

function fetchUsers() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (user:Slacker) RETURN user',
        }, function(err, results){
            if (err) {
                console.error('Error fetching all data:', err);
                reject();
            } else {
                console.log('returning all data');
                let nodes = [];
                for (let node of results) {
                    console.log(node);
                    nodes.push({
                        id: node.user._id,
                        title: node.user.properties.name
                    });
                }
                resolve(nodes);
            }
        })
    })
}

function fetchDemerits() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (from:Slacker)-[relationship:GAVE_DEMERIT]->(to:Slacker) RETURN relationship',
        }, function(err, results){
            if (err) {
                console.error('Error fetching all data:', err);
                reject();
            } else {
                console.log('returning all data');
                let nodes = [];
                for (let node of results) {
                    console.log(node);
                    nodes.push({
                        source: node.relationship._fromId,
                        target: node.relationship._toId,
                        title: "Gave Demerit",
                        count: node.relationship.properties.count
                    });
                }
                resolve(nodes);
            }
        })
    })
}