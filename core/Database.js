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
let out = require('./Logs');

class Database {
    static dbInit() {
        let query = "SELECT name FROM sqlite_master WHERE type='table' AND name='Users'";

        db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.dbInit::Users::SELECT", err);
            } else if (rows === undefined) {
                query = "CREATE TABLE Users ('id' primary key, 'active' INTEGER, \
                                             'userName' VARCHAR(255), 'givenName' VARCHAR(255), \
                                             'middleName' VARCHAR(255), 'familyName' VARCHAR(255), \
                                             'email' VARCHAR(255))";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.dbInit::Users::CREATE", err);
                    }
                });
            }
        });

        query = "SELECT name FROM sqlite_master WHERE type='table' AND name='Groups'";

        db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.dbInit::Groups::SELECT", err);
            } else if (rows === undefined) {
                query = "CREATE TABLE Groups ('id' primary key, 'displayName' VARCHAR(255))";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.dbInit::Groups::CREATE", err);
                    }
                })
            }
        });

        query = "SELECT name FROM sqlite_master WHERE type='table' AND name='GroupMemberships'";

        db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.dbInit::GroupMemberships::SELECT", err);
            } else if (rows === undefined) {
                query = "CREATE TABLE GroupMemberships ('id' primary key, 'groupId' VARCHAR(255), 'userId' VARCHAR(255))";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.dbInit::GroupMemberships::CREATE", err);
                    }
                });
            }
        });
    }

    static async getFilteredUsers(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE " + filterAttribute + "='" + filterValue + "'";

        await db.all(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getFilteredUsers", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            if (Array.isArray(rows)) {
                callback(scimCore.createSCIMUserList(rows, startIndex, count, reqUrl));
            } else {
                callback(scimCore.parseSCIMUser(rows, reqUrl));
            }
        });
    }

    static async getFilteredGroups(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Groups WHERE " + filterAttribute + "='" + filterValue + "'";

        await db.all(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getFilteredGroups", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("Group Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            if (Array.isArray(rows)) {
                callback(scimCore.createSCIMGroupList(rows, startIndex, count, reqUrl));
            } else {
                callback(scimCore.parseSCIMGroup(rows, reqUrl));
            }
        });
    }

    static async getAllUsers(startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Users";

        await db.all(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getAllUsers", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            callback(scimCore.createSCIMUserList(rows, startIndex, count, reqUrl));
        });
    }

    static async getAllGroups(startIndex, count, reqUrl, callback) {
        let query = "SELECT * FROM Groups";

        await db.all(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getAllGroups", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            }

            if (rows.length < count) {
                count = rows.length;
            }

            callback(scimCore.createSCIMGroupList(rows, startIndex, count, reqUrl));
        });
    }

    static async getUser(userId, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE id = '" + String(userId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getUser", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            } else {
                callback(scimCore.parseSCIMUser(rows, reqUrl));
            }
        });
    }

    static async getGroup(groupId, reqUrl, callback) {
        let query = "SELECT * FROM Groups WHERE id = '" + String(groupId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.getGroup", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("Group Not Found", "404"));
            } else {
                callback(scimCore.parseSCIMGroup(rows, reqUrl));
            }
        });
    }

    static async createUser(userModel, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE userName='" + userModel["userName"] + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.createUser::SELECT", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                let userId = String(uuid.v1());

                query = "INSERT INTO Users (id, active, userName, givenName, middleName, familyName, email) \
                         VALUES ('" + String(userId) + "', '" + userModel["active"] + "', '" + userModel["userName"] +
                        "', '" + userModel["givenName"] + "', '" + userModel["middleName"] + "', '" +
                        userModel["familyName"] + "', '" + userModel["email"] + "')";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.createUser::INSERT", err);

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

    static async createGroup(groupModel, reqUrl, callback) {
        let query = "SELECT * FROM Groups WHERE displayName='" + groupModel["displayName"] + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.createGroup::SELECT", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                let groupId = String(uuid.v1());

                query = "INSERT INTO Groups (id, displayName) \
                         VALUES ('" + String(groupId) + "', '" + groupModel["displayName"] + "')";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.createGroup::INSERT", err);

                        callback(scimCore.createSCIMError(err, "400"));
                    }

                    callback(scimCore.createSCIMGroup(groupId, groupModel["displayName"], reqUrl));
                });
            } else {
                callback(scimCore.createSCIMError("Conflict - Group already exists", "409"));
            }
        });
    }

    static async patchUser(attributeName, attributeValue, userId, reqUrl, callback) {
        let query = "UPDATE Users SET " + attributeName + " = '" + attributeValue + "' WHERE id = '" + String(userId) + "'";

        await db.run(query, function (err) {
            if (err !== null) {
                out.error("Database.patchUser::UPDATE", err);

                callback(scimCore.createSCIMError(err, "400"));
            }

            query = "SELECT * FROM Users WHERE id = '" + userId + "'";

            db.get(query, function (err, rows) {
                if (err !== null) {
                    out.error("Database.patchUser::SELECT", err);

                    callback(scimCore.createSCIMError(err, "400"));
                } else if (rows === undefined) {
                    callback(scimCore.createSCIMError("User Not Found", "404"));
                } else {
                    callback(scimCore.createSCIMUser(userId, rows.active, rows.userName, rows.givenName, rows.middleName, rows.familyName, rows.email, reqUrl));
                }
            });
        });
    }

    static async patchGroup(attributeName, attributeValue, groupId, reqUrl, callback) {
        let query = "UPDATE Groups SET " + attributeName + " = '" + attributeValue + "' WHERE id = '" + String(groupId) + "'";

        await db.run(query, function (err) {
            if (err !== null) {
                out.error("Database.patchGroup::UPDATE", err);

                callback(scimCore.createSCIMError(err, "400"));
            }

            query = "SELECT * FROM Groups WHERE id = '" + groupId + "'";

            db.get(query, function (err, rows) {
                if (err !== null) {
                    out.error("Database.patchGroup::SELECT", err);

                    callback(scimCore.createSCIMError(err, "400"));
                } else if (rows === undefined) {
                    callback(scimCore.createSCIMError("Group Not Found", "404"));
                } else {
                    callback(scimCore.parseSCIMGroup(rows, reqUrl));
                }
            });
        });
    }

    static async updateUser(userModel, userId, reqUrl, callback) {
        let query = "SELECT * FROM Users WHERE id = '" + String(userId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.updateUser::SELECT", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("User Not Found", "404"));
            } else {
                query = "UPDATE Users SET userName = '" + userModel["userName"] + "', givenName = '" + userModel["givenName"] +
                    "', middleName = '" + userModel["middleName"] + "', familyName = '" + userModel["familyName"] +
                    "', email = '" + userModel["email"] + "' WHERE id = '" + String(userId) + "'";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.updateUser::UPDATE", err);

                        callback(scimCore.createSCIMError(err, "400"));
                    }

                    callback(scimCore.createSCIMUser(userId, rows.active, userModel["userName"], userModel["givenName"],
                                                   userModel["middleName"], userModel["familyName"], userModel["email"],
                                                   reqUrl));
                });
            }
        });
    }

    static async updateGroup(groupModel, groupId, reqUrl, callback) {
        let query = "SELECT * FROM Groups WHERE id = '" + String(groupId) + "'";

        await db.get(query, function (err, rows) {
            if (err !== null) {
                out.error("Database.updateGroup::SELECT", err);

                callback(scimCore.createSCIMError(err, "400"));
            } else if (rows === undefined) {
                callback(scimCore.createSCIMError("Group Not Found", "404"));
            } else {
                query = "UPDATE Groups SET displayName = '" + groupModel["displayName"] + "' WHERE id = '" + String(groupId) + "'";

                db.run(query, function (err) {
                    if (err !== null) {
                        out.error("Database.updateGroup::UPDATE", err);

                        callback(scimCore.createSCIMError(err, "400"));
                    }

                    callback(scimCore.createSCIMGroup(groupId, groupModel["displayName"], null, reqUrl));
                });
            }
        });
    }
}

module.exports = Database;