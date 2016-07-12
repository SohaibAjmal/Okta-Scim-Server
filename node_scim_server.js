var express = require('express');

var app = express();
var sqlite3 = require('sqlite3').verbose();  
var db = new sqlite3.Database('test.db'); 
var url = require('url');
var uuid = require('uuid');
var bodyParser = require('body-parser');
var qs = require('querystring');
var busboyBodyParser = require('busboy-body-parser');



app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

app.use(busboyBodyParser());

function GetSCIMList(rows, startIndex, count, req_url)
{
    var scim_resource =  { "Resources": [], 
    "itemsPerPage": 0, 
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ], 
    "startIndex": 0, 
    "totalResults": 0
  }

  var resources = [];
 
  for (var i = (startIndex-1); i < count; i++)
  {
    req_url =  req_url + "/" + rows[i]["id"];
    var userResource =GetSCIMUserResource(rows[i]["id"],rows[i]["active"], rows[i]["userName"],rows[i]["givenName"], rows[i]["middleName"], rows[i]["familyName"], req_url);
    resources.push(userResource);
    req_url = "";
  }

  scim_resource["Resources"] = resources;
  scim_resource["startIndex"] = startIndex;
  scim_resource["itemsPerPage"] = count;
  scim_resource["totalResults"] = count

  return scim_resource;
}


function GetSCIMUserResource(userId, active, userName, givenName, middleName, familyName, req_url)
{

  var scim_user = {
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

function SCIMError(errorMessage, statusCode)
{
  var scim_error = {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        "detail": null,
        "status": null
    }

    scim_error["detail"] = errorMessage;
    scim_error["status"] = statusCode;

    return scim_error;


}

// Creaate User
app.post('/scim/v2/Users',  function (req, res) {
   console.log("IN CREATE USERS");
   
  var url_parts = url.parse(req.url, true);

  var req_url =  url_parts.pathname;

  var requestBody = "";
 	req.on('data', function (data) {

 		
    requestBody += data;
   
		var userJsonData = JSON.parse(requestBody);

		var active = userJsonData['active'];
		var userName = userJsonData['userName'];
		var givenName = userJsonData["name"]["givenName"];
		var middleName = userJsonData["name"]["middleName"];
		var familyName = userJsonData["name"]["familyName"];


		db.get("SELECT * FROM Users WHERE userName='"+userName+"'",
        function(err, rows) {
   
        if (err == null){
    
          if (rows === undefined){
         
             var userId = String(uuid.v1());
             db.run("INSERT INTO 'Users' (id, active, userName, givenName, middleName, familyName) VALUES ('"+ userId+"','"+ active+"','"+ userName+"','"+givenName+"','"+ middleName+"','" + familyName + "')", function(err) {
        
              if(err !== null) {
          
                var scim_error = SCIMError( String(err), "400");
                
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                } 
                else{

                  var scimUserResource = GetSCIMUserResource(userId, active, userName, givenName, middleName, familyName, req_url); 
            
                  res.writeHead(201, {'Content-Type': 'text/json'});
                  res.end(JSON.stringify(scimUserResource));
               }
              });
                         
          }
          else{

            var scim_error = SCIMError( "Conflict - Resource Already Exists", "409");

            res.writeHead(409, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));

          }
       
        }
        else{

          var scim_error = SCIMError( String(err), "400");

          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
        }

   })
   
  });
   
})

app.get("/scim/v2/Users", function (req, res){
console.log("IN USERS");


var url_parts = url.parse(req.url, true);

var query = url_parts.query;

startIndex  = query["startIndex"];
count = query["count"];
filter = query["filter"];

var req_url =  url_parts.pathname;

var selectQuery = "SELECT * FROM Users";
var queryAtrribute = "";
var queryValue = ""

if (filter != undefined)
{

  queryAtrribute = String(filter.split("eq")[0]).trim();
  queryValue = String(filter.split("eq")[1]).trim();

 selectQuery = "SELECT * FROM Users WHERE " + queryAtrribute + " = " + queryValue;

}

db.all(selectQuery , function(err, rows) {
   
        if (err == null){
     
          if (rows === undefined){

            var scim_error = SCIMError( "User Not Found", "404");
            
            res.writeHead(404, {'Content-Type': 'text/plain'});

            res.end(JSON.stringify(scim_error));
  
          }
          else{
            // If requested no. of users is less than all users
            if (rows.length < count)
            {
              count = rows.length
            }

            var scimResource = GetSCIMList(rows,startIndex,count,req_url);

            res.writeHead(200, {'Content-Type': 'application/json'})
            res.end(JSON.stringify(scimResource))
  
          }
       
        }
        else{

          var scim_error = SCIMError( String(err), "400");

          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
        }
   })

})

app.get("/scim/v2/Users/:userId", function (req, res){
console.log("IN Get User By ID");

var url_parts = url.parse(req.url, true);
var query = url_parts.query;
var userId = req.params.userId;


startIndex  = query["startIndex"]
count = query["count"]
var req_url = req.url;

db.get("SELECT * FROM Users WHERE id='"+userId+"'",function(err, rows) {
      

        if (err == null){
     
          if (rows === undefined){

            var scim_error = SCIMError( "User Not Found", "404");
      
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));
          
          }
          else{ 
                  
            var scimUserResource = GetSCIMUserResource(userId, rows.active, rows.userName, rows.givenName, rows.middleName, rows.familyName, req_url);         
            
            res.writeHead(200, {'Content-Type': 'application/json'})
            res.end(JSON.stringify(scimUserResource));

          }
       
        }
        else{

          var scim_error = SCIMError( String(err), "400");
        
          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
        }

   })

})

app.patch("/scim/v2/Users/:userId", function (req, res){

console.log("IN Deactive");

var userId = req.params.userId;

var url_parts = url.parse(req.url, true);


var req_url = url_parts.pathname;

var op = "";
var value = "";
var requestBody = "";
req.on('data', function (data) {

  requestBody += data;
  
  var jsonReqBody = JSON.parse(requestBody);

  op = jsonReqBody["Operations"][0]["op"];
  value = jsonReqBody["Operations"][0]["value"];

  var attribute = Object.keys(value)[0];
  var attrValue = value[attribute];

  if (op == "replace")
  {

    db.run("UPDATE 'Users' SET "+ attribute + " = '" + attrValue + "' WHERE id = '" + String(userId) + "'", function(err) {

      if (err == null)
      {
    
        db.get("SELECT * FROM Users WHERE id='"+userId+"'",function(err, rows) {
            
            if (err == null)
            {
              var scimUserResource = GetSCIMUserResource(userId, rows.active, rows.userName, rows.givenName, rows.middleName, rows.familyName, req_url);         
           
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify(scimUserResource));    

            }
            else
            {
              var scim_error = SCIMError( String(err), "400");

              res.writeHead(400, {'Content-Type': 'application/text' });
              res.end(JSON.stringify(scim_error));
            }

        })

      }
      else
      {

        var scim_error = SCIMError( String(err), "400");

        res.writeHead(400, { 'Content-Type': 'application/text' });
        res.end(JSON.stringify(scim_error));
      }
            
    });
  }
  else
  {
    var scim_error = SCIMError( "Operation Not Supported", "403");

    res.writeHead(403, {'Content-Type': 'application/text' });
    res.end(JSON.stringify(scim_error));

    }  

  }); 


})

app.put("/scim/v2/Users/:userId", function (req, res){

	console.log("IN Update User");

	var userId = req.params.userId;

	var url_parts = url.parse(req.url, true);

	var req_url = url_parts.pathname;

  var requestBody = "";
	req.on('data', function (data) {

    requestBody += data;
   
		var userJsonData = JSON.parse(requestBody);

		var active = userJsonData['active'];
		var userName = userJsonData['userName'];
		var givenName = userJsonData["name"]["givenName"];
		var middleName = userJsonData["name"]["middleName"];
		var familyName = userJsonData["name"]["familyName"];

		db.get("SELECT * FROM Users WHERE id='"+userId+"'",
        function(err, rows) {
   
        if (err == null){
    
          if (rows != undefined){
         
             db.run("UPDATE 'Users' SET userName = '" + String(userName) + "', givenName = '" + String(givenName) + "', middleName ='" + String(middleName) + "', familyName= '" + String(familyName) + "'   WHERE id = '" + userId + "'", function(err) {
        
              if(err !== null) {
          
                var scim_error = SCIMError( String(err), "400");

                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(scim_error));

                } 
                else{

                  var scimUserResource = GetSCIMUserResource(userId, active, userName, givenName, middleName, familyName, req_url); 
            
                  res.writeHead(201, {'Content-Type': 'text/json'});
                  res.end(JSON.stringify(scimUserResource));
               }
              });
                         
          }
          else{

            var scim_error = SCIMError( "User Does Not Exist", "404");

            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));

          }
       
        }
        else{

          var scim_error = SCIMError( String(err), "400");

          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
         
        }

   })
   
  });


});


app.get('/scim/v2', function (req, res) {
   res.send('SCIM');
});


var server = app.listen(8081, function () {

  console.log("Server Running...");
  
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Users'",
         function(err, rows) {
          
    if(err !== null) {
      console.log(err);
    }
    else if(rows === undefined) {
      // console.log("No rows found")
      db.run('CREATE TABLE Users ("id" primary key, "active" INTEGER,"userName" VARCHAR(255), "givenName" VARCHAR(255), "middleName" VARCHAR(255),"familyName" VARCHAR(255))', function(err) {
        if(err !== null) {
          console.log(err);
        }
        else {
          //console.log("SQL Table 'Users' initialized.");
        }
      });
    }
    else {
     // console.log("SQL Table 'Users' already initialized.");
    }
  }); 

})



