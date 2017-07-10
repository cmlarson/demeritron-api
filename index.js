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
        if (to == from) {
            res.status(200).json({ message: "No changes made" });
        }
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

router.post('/mentions', function(req, res) {
    console.log(req.body);
    if (!req.body.to || !req.body.from) {
        res.status(400).json({message: "missing required field 'to' or 'from'"});
    } else if (!req.body.apiKey || req.body.apiKey != apiKey) {
        res.status(401).json({message: "invalid field 'apiKey'"})
    } else {
        const to = req.body.to.toLowerCase();
        const from = req.body.from.toLowerCase();
        if (to == from) {
            res.status(200).json({ message: "No changes made" });
        }
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
                return mentionRelationshipExists(to, from);
            }).then((relationshipExists) => {
                if (relationshipExists) {
                    console.log("updating relationship");
                    return getMentionCount(to, from).then((currentCount) => {
                        return incrementMentionCount(to, from, currentCount);
                    });
                } else {
                    console.log("creating relationship");
                    return createMentionRelationship(to, from);
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
    fetchDemeritUsers().then((userData) => {
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
        res.json({nodes: users, edges: demerits, maxDemeritsGiven: maxDemeritsGiven, maxDemeritsReceived: maxDemeritsReceived, maxDemeritRelationship: maxDemeritRelationship, totalDemerits: totalDemerits});
    }).catch((error) => {
        console.log(error);
        res.status(500).json({message: "An error occurred"});
    });
});

router.get('/mentions', function(req, res) {
    // Do graph db stuff
    let users = {};
    fetchMentionUsers().then((userData) => {
        users = userData;
    }).then(() => {
        return fetchMentions();
    }).then((mentions) => {
        let maxMentionsGiven = 0;
        let maxMentionsReceived = 0;
        let maxMentionRelationship = 0;
        let totalMentions = 0;
        for (let user of users) {
            user.received = 0;
            user.given = 0;
            for (let mention of mentions) {
                if (mention.source == user.id) {
                    user.given = user.given + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.given) ? maxMentionRelationship : user.given;
                }
                if (mention.target == user.id) {
                    user.received = user.received + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.received) ? maxMentionRelationship : user.received;
                }
            }
            totalMentions = totalMentions + user.given;
            maxMentionsReceived = (maxMentionsReceived > user.received) ? maxMentionsReceived : user.received;
            maxMentionsGiven = (maxMentionsGiven > user.given) ? maxMentionsGiven : user.given;
        }
        res.json({nodes: users, edges: mentions, maxMentionsGiven: maxMentionsGiven, maxMentionsReceived: maxMentionsReceived, maxMentionRelationship: maxMentionRelationship, totalMentions: totalMentions});
    }).catch((error) => {
        console.log(error);
        res.status(500).json({message: "An error occurred"});
    });
});

router.get('/data', function(req, res) {
    // Do graph db stuff
    let users = {};
    let relationships = [];
    let maxMentionsGiven = 0;
    let maxMentionsReceived = 0;
    let maxMentionRelationship = 0;
    let totalMentions = 0;
    let maxDemeritsGiven = 0;
    let maxDemeritsReceived = 0;
    let maxDemeritRelationship = 0;
    let totalDemerits = 0;
    fetchAllUsers().then((userData) => {
        users = userData;
    }).then(() => {
        return fetchMentions();
    }).then((mentions) => {
        for (let user of users) {
            user.mentionsReceived = 0;
            user.mentionsGiven = 0;
            for (let mention of mentions) {
                if (mention.source == user.id) {
                    user.mentionsGiven = user.mentionsGiven + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.mentionsGiven) ? maxMentionRelationship : user.mentionsGiven;
                }
                if (mention.target == user.id) {
                    user.mentionsReceived = user.mentionsReceived + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.mentionsReceived) ? maxMentionRelationship : user.mentionsReceived;
                }
            }
            totalMentions = totalMentions + user.mentionsGiven;
            maxMentionsReceived = (maxMentionsReceived > user.mentionsReceived) ? maxMentionsReceived : user.mentionsReceived;
            maxMentionsGiven = (maxMentionsGiven > user.mentionsGiven) ? maxMentionsGiven : user.mentionsGiven;
        }
        for (let mention of mentions) {
            relationships.push(mention);
        }
    }).then(() => {
        return fetchDemerits();
    }).then((demerits) => {
        for (let user of users) {
            user.demeritsReceived = 0;
            user.demeritsGiven = 0;
            for (let demerit of demerits) {
                if (demerit.source == user.id) {
                    user.demeritsGiven = user.demeritsGiven + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.demeritsGiven) ? maxDemeritRelationship : user.demeritsGiven;
                }
                if (demerit.target == user.id) {
                    user.demeritsReceived = user.demeritsReceived + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.demeritsReceived) ? maxDemeritRelationship : user.demeritsReceived;
                }
            }
            totalDemerits = totalDemerits + user.demeritsGiven;
            maxDemeritsReceived = (maxDemeritsReceived > user.demeritsReceived) ? maxDemeritsReceived : user.demeritsReceived;
            maxDemeritsGiven = (maxDemeritsGiven > user.demeritsGiven) ? maxDemeritsGiven : user.demeritsGiven;
        }
        for (let demerit of demerits) {
            relationships.push(demerit);
        }
        res.json({nodes: users, edges: relationships, maxMentionsGiven: maxMentionsGiven, maxMentionsReceived: maxMentionsReceived, maxMentionRelationship: maxMentionRelationship, totalMentions: totalMentions, maxDemeritsGiven: maxDemeritsGiven, maxDemeritsReceived: maxDemeritsReceived, maxDemeritRelationship: maxDemeritRelationship, totalDemerits: totalDemerits});
    }).catch((error) => {
        console.log(error);
        res.status(500).json({message: "An error occurred"});
    });
});

router.get('/data/:username', function(req, res) {
    // Do graph db stuff
    let username = req.params.username;
    let users = {};
    let relationships = [];
    let maxMentionsGiven = 0;
    let maxMentionsReceived = 0;
    let maxMentionRelationship = 0;
    let totalMentions = 0;
    let maxDemeritsGiven = 0;
    let maxDemeritsReceived = 0;
    let maxDemeritRelationship = 0;
    let totalDemerits = 0;
    fetchAllUsers().then((userData) => {
        users = userData;
    }).then(() => {
        return fetchMentionsRelatedToUser(username);
    }).then((mentions) => {
        for (let user of users) {
            user.mentionsReceived = 0;
            user.mentionsGiven = 0;
            for (let mention of mentions) {
                if (mention.source == user.id) {
                    user.mentionsGiven = user.mentionsGiven + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.mentionsGiven) ? maxMentionRelationship : user.mentionsGiven;
                }
                if (mention.target == user.id) {
                    user.mentionsReceived = user.mentionsReceived + mention.count;
                    maxMentionRelationship = (maxMentionRelationship > user.mentionsReceived) ? maxMentionRelationship : user.mentionsReceived;
                }
            }
            totalMentions = totalMentions + user.mentionsGiven;
            maxMentionsReceived = (maxMentionsReceived > user.mentionsReceived) ? maxMentionsReceived : user.mentionsReceived;
            maxMentionsGiven = (maxMentionsGiven > user.mentionsGiven) ? maxMentionsGiven : user.mentionsGiven;
        }
        for (let mention of mentions) {
            relationships.push(mention);
        }
    }).then(() => {
        return fetchDemeritsRelatedToUser(username);
    }).then((demerits) => {
        for (let user of users) {
            user.demeritsReceived = 0;
            user.demeritsGiven = 0;
            for (let demerit of demerits) {
                if (demerit.source == user.id) {
                    user.demeritsGiven = user.demeritsGiven + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.demeritsGiven) ? maxDemeritRelationship : user.demeritsGiven;
                }
                if (demerit.target == user.id) {
                    user.demeritsReceived = user.demeritsReceived + demerit.count;
                    maxDemeritRelationship = (maxDemeritRelationship > user.demeritsReceived) ? maxDemeritRelationship : user.demeritsReceived;
                }
            }
            totalDemerits = totalDemerits + user.demeritsGiven;
            maxDemeritsReceived = (maxDemeritsReceived > user.demeritsReceived) ? maxDemeritsReceived : user.demeritsReceived;
            maxDemeritsGiven = (maxDemeritsGiven > user.demeritsGiven) ? maxDemeritsGiven : user.demeritsGiven;
        }
        for (let demerit of demerits) {
            relationships.push(demerit);
        }
        res.json({nodes: users, edges: relationships, maxMentionsGiven: maxMentionsGiven, maxMentionsReceived: maxMentionsReceived, maxMentionRelationship: maxMentionRelationship, totalMentions: totalMentions, maxDemeritsGiven: maxDemeritsGiven, maxDemeritsReceived: maxDemeritsReceived, maxDemeritRelationship: maxDemeritRelationship, totalDemerits: totalDemerits});
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

function mentionRelationshipExists(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (n1:Slacker)-[:MENTIONED]->(n2:Slacker) WHERE n1.name = {fromUser} AND n2.name = {toUser} RETURN n1, n2',
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
                    console.log("found mention relationship between:", from, to);
                    resolve(true);
                } else {
                    console.log("No mention relationship between:", from, to);
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

function createMentionRelationship(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (to:Slacker), (from:Slacker) WHERE to.name = {toUser} AND from.name = {fromUser} CREATE (from)-[:MENTIONED {count: 1}]->(to)',
            params: {
                toUser: to,
                fromUser: from
            }
        }, function(err, results){
            if (err) {
                console.error('Error creating mention relationship:', err);
                reject();
            } else {
                console.log('created new mention relationship:', from, to);
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

function getMentionCount(to, from) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (n1:Slacker)-[r:MENTIONED]->(n2:Slacker) WHERE n1.name = {fromUser} AND n2.name = {toUser} RETURN r.count',
            params: {
                toUser: to,
                fromUser: from
            }
        }, function(err, results){
            if (err) {
                console.error('Error getting mention count:', err);
                reject();
            } else {
                const count = results[0]["r.count"];
                console.log('Mentions:', from, to, count);
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

function incrementMentionCount(to, from, currentCount) {
    return new Promise((resolve, reject) => {
        const newCount = currentCount + 1;
        db.cypher({
            query: 'MATCH (from:Slacker)-[r:MENTIONED]->(to:Slacker) WHERE to.name = {toUser} AND from.name = {fromUser} SET r.count = {count}',
            params: {
                toUser: to,
                fromUser: from,
                count: newCount
            }
        }, function(err, results){
            if (err) {
                console.error('Error incrementing mention count:', err);
                reject();
            } else {
                console.log('incremented mention count:', from, to, newCount);
                resolve();
            }
        });
    });
}

function fetchDemeritUsers() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (user:Slacker)-[:GAVE_DEMERIT]-(b) RETURN distinct user',
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

function fetchMentionUsers() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (user:Slacker)-[:MENTIONED]-(b) RETURN distinct user',
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

function fetchAllUsers() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (user:Slacker) RETURN distinct user',
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

function fetchMentions() {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (from:Slacker)-[relationship:MENTIONED]->(to:Slacker) RETURN relationship',
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
                        title: "Mentioned",
                        count: node.relationship.properties.count
                    });
                }
                resolve(nodes);
            }
        })
    })
}

function fetchDemeritsRelatedToUser(username) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (from:Slacker)-[relationship:GAVE_DEMERIT]-(to:Slacker) WHERE from.name = {user} OR to.name = {user} RETURN relationship',
            params: {
                user: username,
            }
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

function fetchMentionsRelatedToUser(username) {
    return new Promise((resolve, reject) => {
        db.cypher({
            query: 'MATCH (from:Slacker)-[relationship:MENTIONED]-(to:Slacker) WHERE from.name = {user} OR to.name = {user} RETURN relationship',
            params: {
                user: username,
            }
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
                        title: "Mentioned",
                        count: node.relationship.properties.count
                    });
                }
                resolve(nodes);
            }
        })
    })
}