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

class SCIMCore {
    static getSCIMUserList(rows, startIndex, count, reqUrl) {
        let scimResource = {
            "Resources": [],
            "itemsPerPage": 0,
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "startIndex": 0,
            "totalResults": 0
        };

        let resources = [];
        let location = "";

        for (let i = (startIndex - 1); i < count; i++) {
            location = reqUrl + "/" + rows[i]["id"];

            let userResource = this.createSCIMUser(
                rows[i]["id"],
                rows[i]["active"],
                rows[i]["userName"],
                rows[i]["givenName"],
                rows[i]["middleName"],
                rows[i]["familyName"],
                rows[i]["email"],
                location
            );

            resources.push(userResource);
            location = "";
        }

        scimResource["Resources"] = resources;
        scimResource["startIndex"] = startIndex;
        scimResource["itemsPerPage"] = count;
        scimResource["totalResults"] = count;

        return scimResource;
    }

    static createSCIMUser(userId, active, userName, givenName, middleName, familyName, email, reqUrl) {
        let scimUser = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": null,
            "userName": null,
            "name": {
                "givenName": null,
                "middleName": null,
                "familyName": null
            },
            "emails":
                [{
                    "primary": true,
                    "value": null,
                    "type": "work"
                }],
            "active": false,
            "meta": {
                "resourceType": "User",
                "location": null
            }
        };

        scimUser["meta"]["location"] = reqUrl;
        scimUser["id"] = userId;
        scimUser["active"] = active;
        scimUser["userName"] = userName;
        scimUser["name"]["givenName"] = givenName;
        scimUser["name"]["middleName"] = middleName;
        scimUser["name"]["familyName"] = familyName;
        scimUser["emails"][0]["value"] = email;

        return scimUser;
    }

    static createSCIMError(errorMessage, statusCode) {
        let scimError = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": null,
            "status": null
        };

        scimError["detail"] = errorMessage;
        scimError["status"] = statusCode;

        return scimError;
    }
}

module.exports = SCIMCore;