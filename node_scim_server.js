/** Copyright © 2016-2018, Okta, Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// Dependencies
let express = require('express');
let app = express();
let sqlite3 = require('sqlite3').verbose();
let url = require('url');
let uuid = require('uuid');
let bodyParser = require('body-parser');

let db = new sqlite3.Database('test.db');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/**
 *   Constructor for creating SCIM Resource
 */
function GetSCIMList(rows, startIndex, count, req_url) {
    let scim_resource =  {
        "Resources": [],
        "itemsPerPage": 0,
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "startIndex": 0,
        "totalResults": 0
    }

    let resources = [];
    let location = ""
    for (let i = (startIndex-1); i < count; i++) {
        location =  req_url + "/" + rows[i]["id"];
        let userResource = GetSCIMUserResource(
            rows[i]["id"],
            rows[i]["active"],
            rows[i]["userName"],
            rows[i]["givenName"],
            rows[i]["middleName"],
            rows[i]["familyName"],
            location);
        resources.push(userResource);
        location = "";
    }

    scim_resource["Resources"] = resources;
    scim_resource["startIndex"] = startIndex;
    scim_resource["itemsPerPage"] = count;
    scim_resource["totalResults"] = count

    return scim_resource;
}

/**
 *  Returns JSON dictionary of SCIM response
 */
function GetSCIMUserResource(userId, active, userName,
                             givenName, middleName, familyName, req_url) {

    let scim_user = {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": null,
        "userName": null,
        "name": {
            "givenName": null,
            "middleName": null,
            "familyName": null,
        },
        "active": false,
        "meta": {
            "resourceType": "User",
            "location": null,
        }
    };

    scim_user["meta"]["location"] = req_url;
    scim_user["id"] = userId;
    scim_user["active"] = active;
    scim_user["userName"] = userName;
    scim_user["name"]["givenName"] = givenName;
    scim_user["name"]["middleName"] = middleName;
    scim_user["name"]["familyName"] = familyName;

    return scim_user;
}

/**
 *  Returns an error message and status code
 */
function SCIMError(errorMessage, statusCode) {
    let scim_error = {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        "detail": null,
        "status": null
    }

    scim_error["detail"] = errorMessage;
    scim_error["status"] = statusCode;

    return scim_error;
}

/**
 *  Creates a new User with given attributes
 */
app.post('/scim/v2/Users', function (req, res) {
    let url_parts = url.parse(req.url, true);
    let req_url =  url_parts.pathname;
    let requestBody = "";

    req.on('data', function (data) {
        requestBody += data;
        let userJsonData = JSON.parse(requestBody);
        let active = userJsonData['active'];
        let userName = userJsonData['userName'];
        let givenName = userJsonData["name"]["givenName"];
        let middleName = userJsonData["name"]["middleName"];
        let familyName = userJsonData["name"]["familyName"];

        console.log("Received request to create user " + userName);

        let usernameQuery = "SELECT * FROM Users WHERE userName='" + userName + "'";
        db.get(usernameQuery, function(err, rows) {
            if (err == null) {
                if (rows === undefined) {
                    let userId = String(uuid.v1());
                    let runQuery = "INSERT INTO 'Users' (id, active, userName, givenName,\
                       middleName, familyName) VALUES ('" + userId + "','"
                        + active + "','" + userName + "','" + givenName + "','"
                        + middleName + "','" + familyName + "')";
                    db.run(runQuery, function(err) {
                        if(err !== null) {
                            let scim_error = SCIMError( String(err), "400");
                            res.writeHead(400, {'Content-Type': 'text/plain'});
                            res.end(JSON.stringify(scim_error));

                            console.log("Error occurred: " + err);
                        } else {
                            let scimUserResource = GetSCIMUserResource(userId, active, userName,
                                givenName, middleName, familyName, req_url);

                            res.writeHead(201, {'Content-Type': 'text/json'});
                            res.end(JSON.stringify(scimUserResource));

                            console.log("User created successfully.");
                        }
                    });
                } else {
                    let scim_error = SCIMError( "Conflict - Resource Already Exists", "409");
                    res.writeHead(409, {'Content-Type': 'text/plain'});
                    res.end(JSON.stringify(scim_error));

                    console.log("Error occurred: Resource already exists.")
                }
            } else {
                let scim_error = SCIMError( String(err), "400");
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                console.log("Error occurred: " + err);
            }
        });
    });
});

/**
 *  Return filtered Users stored in database
 *
 *  Pagination supported
 */
app.get("/scim/v2/Users", function (req, res) {
    let url_parts = url.parse(req.url, true);
    let query = url_parts.query;
    startIndex  = query["startIndex"];
    count = query["count"];
    filter = query["filter"];

    let req_url =  url_parts.pathname;
    let selectQuery = "SELECT * FROM Users";
    let queryAtrribute = "";
    let queryValue = "";

    if (filter != undefined) {
        queryAtrribute = String(filter.split("eq")[0]).trim();
        queryValue = String(filter.split("eq")[1]).trim();
        selectQuery = "SELECT * FROM Users WHERE " + queryAtrribute + " = " + queryValue;

        console.log("Received request to get filtered users: " + filter);
    } else {
        console.log("Received request to get users.");
    }

    db.all(selectQuery , function(err, rows) {
        if (err == null) {
            if (rows === undefined) {
                let scim_error = SCIMError( "User Not Found", "404");
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                console.log("Error occurred: User not found.");
            } else {
                // If requested no. of users is less than all users
                if (rows.length < count) {
                    count = rows.length
                }

                let scimResource = GetSCIMList(rows,startIndex,count,req_url);
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify(scimResource))

                console.log("Users listed.");
            }
        } else {
            let scim_error = SCIMError( String(err), "400");
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));

            console.log("Error occurred: " + err);
        }
    });
});

/**
 *  Queries database for User with identifier
 *
 *  Updates response code with '404' if unable to locate User
 */
app.get("/scim/v2/Users/:userId", function (req, res){
    let url_parts = url.parse(req.url, true);
    let query = url_parts.query;
    let userId = req.params.userId;

    startIndex  = query["startIndex"]
    count = query["count"]
    let req_url = req.url;
    let queryById = "SELECT * FROM Users WHERE id='" + userId + "'";

    console.log("Got request to get resource by id: " + userId);

    db.get(queryById, function(err, rows) {
        if (err == null) {
            if (rows === undefined){
                let scim_error = SCIMError( "User Not Found", "404");
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                console.log("Error occurred: User not found.");
            } else {
                let scimUserResource = GetSCIMUserResource(userId, rows.active, rows.userName,
                    rows.givenName, rows.middleName, rows.familyName, req_url);
                res.writeHead(200, {'Content-Type': 'application/json'})
                res.end(JSON.stringify(scimUserResource));

                console.log("User returned.");
            }
        } else {
            let scim_error = SCIMError( String(err), "400");
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));

            console.log("Error occurred: " + err);
        }
    });
});

/**
 *  Update User attributes via Patch
 */
app.patch("/scim/v2/Users/:userId", function (req, res) {

    let userId = req.params.userId;
    let url_parts = url.parse(req.url, true);
    let req_url = url_parts.pathname;

    let op = "";
    let value = "";
    let requestBody = "";

    req.on('data', function (data) {
        requestBody += data;

        let jsonReqBody = JSON.parse(requestBody);
        op = jsonReqBody["Operations"][0]["op"];
        value = jsonReqBody["Operations"][0]["value"];
        let attribute = Object.keys(value)[0];
        let attrValue = value[attribute];

        console.log("Got request to update user " + userId + ": " + op + " - " + value);

        if (op == "replace") {
            let updateUsersQuery = "UPDATE 'Users' SET "+ attribute + " = '"
                + attrValue + "'WHERE id = '" + String(userId) + "'";
            db.run(updateUsersQuery, function(err) {
                if (err == null) {
                    let queryById = "SELECT * FROM Users WHERE id='"+userId+"'";

                    db.get(queryById, function(err, rows) {
                        if (err == null) {
                            let scimUserResource = GetSCIMUserResource(userId, rows.active, rows.userName,
                                rows.givenName, rows.middleName, rows.familyName, req_url);
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(scimUserResource));

                            console.log("User updated.");
                        } else {
                            let scim_error = SCIMError( String(err), "400");
                            res.writeHead(400, {'Content-Type': 'application/text' });
                            res.end(JSON.stringify(scim_error));

                            console.log("Error occurred: " + err);
                        }
                    });
                } else {
                    let scim_error = SCIMError( String(err), "400");
                    res.writeHead(400, { 'Content-Type': 'application/text' });
                    res.end(JSON.stringify(scim_error));

                    console.log("Error occurred: " + err);
                }
            });
        } else {
            let scim_error = SCIMError( "Operation Not Supported", "403");
            res.writeHead(403, {'Content-Type': 'application/text' });
            res.end(JSON.stringify(scim_error));

            console.log("Error occurred: Operation not supported.");
        }
    });
});

/**
 *  Update User attributes via Put
 */
app.put("/scim/v2/Users/:userId", function (req, res) {
    let userId = req.params.userId;
    let url_parts = url.parse(req.url, true);
    let req_url = url_parts.pathname;
    let requestBody = "";

    req.on('data', function (data) {
        requestBody += data;

        let userJsonData = JSON.parse(requestBody);
        let active = userJsonData['active'];
        let userName = userJsonData['userName'];
        let givenName = userJsonData["name"]["givenName"];
        let middleName = userJsonData["name"]["middleName"];
        let familyName = userJsonData["name"]["familyName"];
        let queryById = "SELECT * FROM Users WHERE id='" + userId + "'";

        console.log("Got request to update user " + userId);

        db.get(queryById, function(err, rows) {
            if (err == null) {
                if (rows != undefined){
                    let updateUsersQuery = "UPDATE 'Users' SET userName = '" + String(userName)
                        + "', givenName = '" + String(givenName) + "', middleName ='"
                        + String(middleName) + "', familyName= '" + String(familyName)
                        + "'   WHERE id = '" + userId + "'";

                    db.run(updateUsersQuery, function(err) {
                        if(err !== null) {
                            let scim_error = SCIMError( String(err), "400");
                            res.writeHead(400, {'Content-Type': 'text/plain'});
                            res.end(JSON.stringify(scim_error));

                            console.log("Error occurred: " + err);
                        } else {
                            let scimUserResource = GetSCIMUserResource(userId, active, userName,
                                givenName, middleName, familyName, req_url);
                            res.writeHead(201, {'Content-Type': 'text/json'});
                            res.end(JSON.stringify(scimUserResource));

                            console.log("User updated.");
                        }
                    });
                } else {
                    let scim_error = SCIMError( "User Does Not Exist", "404");
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end(JSON.stringify(scim_error));

                    console.log("Error occurred: User does not exist.");
                }
            } else {
                let scim_error = SCIMError( String(err), "400");
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                console.log("Error occurred: " + err);
            }
        });
    });
});

/**
 *  Default URL
 */
app.get('/scim/v2', function (req, res) { res.send('SCIM'); });

/**
 *  Instantiates or connects to DB
 */
let server = app.listen(8081, function () {
    let databaseQuery = "SELECT name FROM sqlite_master WHERE type='table' \
                      AND name='Users'";
    db.get(databaseQuery, function(err, rows) {
        if(err !== null) { console.log(err); }
        else if(rows === undefined) {
            let createTable = 'CREATE TABLE Users ("id" primary key, \
                        "active" INTEGER,"userName" letCHAR(255), \
                        "givenName" letCHAR(255), "middleName" letCHAR(255), \
                        "familyName" letCHAR(255))';
            db.run(createTable, function(err) {
                if(err !== null) { console.log(err); }
            });
        }
    });
});



