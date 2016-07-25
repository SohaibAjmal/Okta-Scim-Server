/** Copyright © 2016, Okta, Inc.
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
var express = require('express');
var app = express();
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('test.db');
var url = require('url');
var uuid = require('uuid');
var bodyParser = require('body-parser');
var qs = require('querystring');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/** 
 *   Constructor for creating SCIM Resource 
 */
function GetSCIMList(rows, startIndex, count, req_url) {
  var scim_resource =  {
    "Resources": [],
    "itemsPerPage": 0,
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ],
    "startIndex": 0,
    "totalResults": 0
  }

  var resources = [];

  for (var i = (startIndex-1); i < count; i++) {
    req_url =  req_url + "/" + rows[i]["id"];
    var userResource = GetSCIMUserResource(
      rows[i]["id"],rows[i]["active"],
      rows[i]["userName"],
      rows[i]["givenName"],
      rows[i]["middleName"],
      rows[i]["familyName"],
      req_url
      );
    resources.push(userResource);
    req_url = "";
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
    var scim_user = {
      "schemas": [
        "urn:ietf:params:scim:schemas:core:2.0:User"
        ],
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
 *  Creates a new User with given attributes
 */
app.post('/scim/v2/Users',  function (req, res) {

  var url_parts = url.parse(req.url, true);
  var req_url =  url_parts.pathname;

  var active = "";
  var userName = "";
  var givenName = "";
  var middleName = "";
  var familyName = "";

  /* If request is coming from Okta */
  if (Object.keys(req.body).length == 0) {
    req.on('data', function (data) {
      var requestBody = "";
      requestBody += data;

      var userJsonData = JSON.parse(requestBody);
      active = userJsonData['active'];
      userName = userJsonData['userName'];
      givenName = userJsonData["name"]["givenName"];
      middleName = userJsonData["name"]["middleName"];
      familyName = userJsonData["name"]["familyName"];
    });
  }
  else {
    /*If request is coming from other test client such as Postman/Runscope*/
     active = req.body.active;
     userName = req.body.userName;
     givenName = req.body.name.givenName;
     middleName = req.body.name.middleName;
     familyName = req.body.name.familyName;
  }

  /**
   *  Insert into database
   */
  var usernameQuery = "SELECT * FROM Users WHERE userName='"+userName+"'";
  db.get(usernameQuery, function(err, rows) {
    if (err == null){
      if (rows === undefined){
        var userId = String(uuid.v1());
        var runQuery = "INSERT INTO 'Users' (id, active, userName, givenName,\
                       middleName, familyName) VALUES ('" + userId + "','" 
                       + active + "','" + userName + "','" + givenName + "','"
                       + familyName + "')";
        
        db.run(runQuery, function(err) {
          if(err !== null) {
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end(err);
          }
          else {
            var scimUserResource = GetSCIMUserResource(userId, active, userName,
              givenName, middleName, familyName, req_url);
            res.writeHead(201, {'Content-Type': 'text/json'});
            res.end(JSON.stringify(scimUserResource));
          }
        });
      }
      else {
        res.writeHead(409, {'Content-Type': 'text/plain'});
        res.end("Conflict - Resouce Already Exists");
      }
    }
    else {
      res.writeHead(410, {'Content-Type': 'text/plain'});
      res.end(err);
    }
  });
});

/**
 *  Return filtered Users stored in database
 *
 *  Pagination supported
 */
app.get("/scim/v2/Users", function (req, res){
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  startIndex  = query["startIndex"];
  count = query["count"];
  filter = query["filter"];

  var req_url =  url_parts.pathname;
  var selectQuery = "SELECT * FROM Users";
  var queryAtrribute = "";
  var queryValue = ""
  if (filter != undefined) {
    queryAtrribute = String(filter.split("eq")[0]).trim();
    queryValue = String(filter.split("eq")[1]).trim();
    selectQuery = "SELECT * FROM Users WHERE " + queryAtrribute + " = " + queryValue;
  }

  db.all(selectQuery , function(err, rows) {
    if (err == null){
      if (rows === undefined){
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end("User Not Found");
      }
      else {
        // If requested no. of users is less than all users
        if (rows.length < count){ count = rows.length }
        var scimResource = GetSCIMList(rows,startIndex,count,req_url);
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify(scimResource))
      }
    }
    else {
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(err);
    }
  });
});

/**
 *  Queries database for User with identifier
 *
 *  Updates response code with '404' if unable to locate User
 */
app.get("/scim/v2/Users/:userId", function (req, res){

  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var userId = req.params.userId;

  startIndex  = query["startIndex"]
  count = query["count"]
  var req_url = req.url;
  var queryById = "SELECT * FROM Users WHERE id='" + userId + "'";
  
  db.get(queryById, function(err, rows) {
    if (err == null) {
      if (rows === undefined){
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end("User Not Found");
      }
      else {
        var scimUserResource = GetSCIMUserResource(userId, rows.active,
          rows.userName, rows.givenName, rows.middleName, rows.familyName, req_url);
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify(scimUserResource));
      }
    }
    else {
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(err);
    }
  });
});

/**
 *  Update User attributes via Patch
 */
app.patch("/scim/v2/Users/:userId", function (req, res){
  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;
  var op = "";
  var value = "";

  /* If request is coming from Okta */
  if (Object.keys(req.body).length == 0) {
    req.on('data', function (data) {
      var requestBody = '';
      requestBody += data;
      var jsonReqBody = JSON.parse(requestBody);
      op = String(jsonReqBody['Operations'][0]['op']);
      value = String(jsonReqBody['Operations'][0]['value']);
    });
  }
  else {
    /* If request is coming from other test client such as Postman/Runscope */
    op = req.body.Operations[0].op;
    value = req.body.Operations[0].value;
  }

  var attribute = Object.keys(value)[0];
  var attrValue = value[attribute];

  if (op == "replace") {
    var updateUsersQuery = "UPDATE 'Users' SET "+ attribute + " = '"
                            + attrValue + "'WHERE id = '" + String(userId) + "'";
    
    db.run(updateUsersQuery, function(err) {
      if (err == null) {
        var queryById = "SELECT * FROM Users WHERE id='"+userId+"'";
        
        db.get(queryById, function(err, rows) {
          if (err == null) {
            var scimUserResource = GetSCIMUserResource(userId, rows.active,
              rows.userName, rows.givenName, rows.middleName, rows.familyName, req_url);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(scimUserResource));
          }
          else {
            res.writeHead(400, {'Content-Type': 'application/text' });
            res.end(JSON.stringify(err));
          }
        });
      }
      else {
        res.writeHead(400, { 'Content-Type': 'application/text' });
        res.end(JSON.stringify(err));
      }
    });
  }
  else {
    res.writeHead(403, {'Content-Type': 'application/text' });
    res.end(JSON.stringify("Operation Not Supported"));
  }
});


app.get('/scim/v2', function (req, res) { res.send('SCIM'); });

/**
 *  Instantiates or connect to DB
 */
var server = app.listen(8081, function () {
  var databaseQuery = "SELECT name FROM sqlite_master WHERE type='table' \
                      AND name='Users'";
  db.get(databaseQuery, function(err, rows) {
    if(err !== null) { console.log(err); }
    else if(rows === undefined) {
      var createTable = 'CREATE TABLE Users ("id" primary key, \
                        "active" INTEGER,"userName" VARCHAR(255), \
                        "givenName" VARCHAR(255), "middleName" VARCHAR(255), \
                        "familyName" VARCHAR(255))';
      db.run(createTable, function(err) {
        if(err !== null) { console.log(err); }
      });
    }
  });
});
