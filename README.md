# Demeritron-Api

This application serves as an API layer the Demeritron Bot (demeritron.herokuapp.com)
The server utilizes a Neo4j graph database to maintain relationship data between users and tracks the number of demerits each has given to each other.

## API
Base URL: https://demeritron-api.herokuapp.com

### Health
Determine if the server is live and healthy
`GET /health`
Returns a 200 response if the server is live

### Add Demerit
Give a demerit from one user to another
`POST /demerits`
```
{
    "to": string,
    "from": string,
    "apiKey": string
}
```

### Add Mention
Give a demerit from one user to another
`POST /mentions`
```
{
    "to": string,
    "from": string,
    "apiKey": string
}
```

### Fetch Demerit Data
Returns all users and their relational demerit data
`GET /demerits`

### Fetch Mention Data
Returns all users and their relational mention data
`GET /mentions`

### Fetch All Data
Returns all users and their relational data
`GET /data`