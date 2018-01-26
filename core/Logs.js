class Logs {
    static log(type, action, message) {
        let logEntry = "[ " + type + " ] [ " + action + " ] " + message;

        console.log(logEntry);
    }
}

module.exports = Logs;