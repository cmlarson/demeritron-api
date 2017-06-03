'use strict';

let express = require('express');
let app = express();
let bodyParser = require('body-parser');
app.use(bodyParser.json());
let port = process.env.PORT || 3000;
let router = express.Router(); 

router.get('/health', function(req, res) {
    res.json({ message: 'server is healthy' });   
});

/*
request body:
{
    "from": string,
    "to": string
}
*/
router.post('/demerits', function(req, res) {
    console.log(req.body);
    if (!req.body.to || !req.body.from) {
        res.status(400).json({message: "missing required field 'to' or 'from'"});
    } else {
        // Do graph db stuff
        res.json({ message: "done" });
    }
});

router.get('/demerits', function(req, res) {
    // Do graph db stuff
    res.json({ message: "done" });
});

app.use('/', router);

app.listen(port);
console.log('Api running on port ' + port);