const { Jira } = require("../jira/jira.js");

const jira = new Jira("","", "")

async function getStatus(){
    const status = await jira.getStatus("RFC-16")
    console.log(status.status.id)
}

async function createTask(){
    const data = {
        "tittle": "test-tittle",
        "body": "hehe"
    }
    const task = await jira.createTask("RFC", data, ["TA-1", "TA-3"])
    console.log(task)
}

createTask()