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

let sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('scim.db');

let uuid = require('uuid');

let scimCore = require('./SCIMCore');

class Database {
    static dbInit() {
        let query = "SELECT name FROM sqlite_master WHERE type='table' AND name='Users'";

        db.get(query, function (err, rows) {
            if (err !== null) {
                console.error(err);
            } else if (rows === undefined) {
                query = "CREATE TABLE Users ('id' primary key, 'active' INTEGER, \
                                             'userName' letCHAR(255), 'givenName' letCHAR(255), \
                                             'middleName' letCHAR(255), 'familyName' letCHAR(255), \
                                             'email' letCHAR(255))";

                db.run(query, function (err) {
                    if (err !== null) {
                        console.error(err);
                    }
                });
            }
        });
    }

    static async getFilteredUsers(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE " + filterAttribute + "='" + filterValue + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            callback(scimCore.getSCIMUserList(rows, startIndex, count, reqUrl));
        });
    }

    static async getAllUsers(startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Users";

        await db.get(query, function (err, rows) {

            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            callback(scimCore.getSCIMUserList(rows, startIndex, count, reqUrl));
        });
    }

    static async getUser(userId, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE id = '" + String(userId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            } else {
                callback(scimCore.createSCIMUser(userId, rows.active, rows.userName, rows.givenName, rows.middleName, rows.familyName, rows.email, reqUrl));
            }
        });
    }

    static async createUser(userModel, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE userName='" + userModel["userName"] + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                let userId = String(uuid.v1());

                query = "INSERT INTO Users (id, active, userName, givenName, middleName, familyName, email) \
                         VALUES ('" + String(userId) + "', '" + userModel["active"] + "', '" + userModel["userName"] +
                        "', '" + userModel["givenName"] + "', '" + userModel["middleName"] + "', '" +
                        userModel["familyName"] + "', '" + userModel["email"] + "')";

                db.run(query, function (err) {
                    if (err !== null) {
                        console.error(err);

                        callback(scimCore.createSCIMError(err, "400"));
                    }

                    callback(scimCore.createSCIMUser(userId, userModel["active"], userModel["userName"],
                                                   userModel["givenName"], userModel["middleName"],
                                                   userModel["familyName"], userModel["email"], reqUrl));
                });
            } else {
                callback(scimCore.createSCIMError("Conflict - User already exists", "409"));
            }
        });
    }

    static async patchUser(attributeName, attributeValue, userId, reqUrl, callback) {
        let query = "UPDATE Users SET " + attributeName + " = '" + attributeValue + "' WHERE id = '" + String(userId) + "'";

        await db.run(query, function (err) {
            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            }

            query = "SELECT * FROM Users WHERE id = '" + userId + "'";

            db.get(query, function (err, rows) {
                if (err !== null) {
                    console.error(err);

                    callback(scimCore.createSCIMError(err, "400"));
                } else if (rows === undefined) {
                    callback(scimCore.createSCIMError("User Not Found", "404"));
                } else {
                    callback(scimCore.createSCIMUser(userId, rows.active, rows.userName, rows.givenName, rows.middleName, rows.familyName, rows.email, reqUrl));
                }
            });
        });
    }

    static async updateUser(userModel, userId, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE id = '" + String(userId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                console.error(err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            } else {
                query = "UPDATE Users SET userName = '" + userModel["userName"] + "', givenName = '" + userModel["givenName"] +
                    "', middleName = '" + userModel["middleName"] + "', familyName = '" + userModel["familyName"] +
                    "', email = '" + userModel["email"] + "' WHERE id = '" + String(userId) + "'";

                db.run(query, function (err) {
                    if (err !== null) {
                        console.error(err);

                        callback(scimCore.createSCIMError(err, "400"));
                    }

                    callback(scimCore.createSCIMUser(userId, rows.active, userModel["userName"], userModel["givenName"],
                                                   userModel["middleName"], userModel["familyName"], userModel["email"],
                                                   reqUrl));
                });
            }
        });
    }
}

module.exports = Database;