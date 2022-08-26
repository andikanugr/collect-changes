const core = require('@actions/core');
const { Octokit } = require("@octokit/action");
const { Member, Slack, Sheet } = require("dg-action-tools");

const service = core.getInput('service')
const services = service.split(",")
const excludedUser = core.getInput('exclude')
const excludedUsers = excludedUser.split(",")

const octokit = new Octokit();
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

const slackToken = process.env.SLACK_BOT_TOKEN
const slackSecret = process.env.SLACK_BOT_SECRET
const slackChannel = core.getInput('slack_channel')
const slack = new Slack(slackToken, slackSecret)

const sheetId = process.env.GOOGLE_SHEET_ID
const keys = process.env.GOOGLE_ACCOUNT_KEY
const sheet = new Sheet(keys, sheetId)

const userAccount = await sheet.batchGet("user mapping")
const users = sheet.valueToArray(userAccount)
const member = new Member(users)

const deployemntTemplate = `Deployment :fire:\n\nService: {service}\nPIC: {pic}\nRFC: {rfc}\nTag: {tag}\nRelease: {release}`

async function main(){
    const releaseData = await extractReleaseData()
    
    const {message, attachments} = composeThread(releaseData)
    const ts = await slack.sendMessageWithAttachmentsToChannel(slackChannel, message, attachments)
    releaseData.thread = ts
    const featureRelease = composeFeatureRelease(releaseData)
    await slack.replyThread(slackChannel, ts, featureRelease)

    await composeDeploymentLog(releaseData)
}

async function composeDeploymentLog(data){
    const deploymentLog = await sheet.batchGet("deployment log")
    const deploymentLogObj = sheet.getEmptyValueHeaderObject(deploymentLog)
    deploymentLogObj.Date = new Date().toLocaleString()
    deploymentLogObj.Service = data.service
    deploymentLogObj.Release = data.releaseHash
    deploymentLogObj.Stable = data.stableHash
    deploymentLogObj.Tag = data.tag
    deploymentLogObj.TagUrl = data.tagUrl
    deploymentLogObj.PIC = data.pic
    deploymentLogObj.CMA = ''
    deploymentLogObj.Thread = data.thread
    deploymentLogObj.RFC = ''
    deploymentLogObj.Pipeline = ''
    deploymentLogObj.Status = data.status
    deploymentLogObj.Changes = JSON.stringify(data.changes)

    let tasks = []
    let eic = []
    for(const change of data.changes){
        tasks.push(change.issue)
        eic.push(change.author)
    }
    deploymentLogObj.Tasks = tasks.toString()
    deploymentLogObj.EIC = [...new Set(eic)].toString()
    sheet.appendWithObject("deployment log", deploymentLogObj)
}

async function getLatestRelease(){
    const resp = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
        owner: owner,
        repo: repo
    })

    return resp.data
}

async function extractReleaseData(){
    const data = await getLatestRelease()
    if(excludedUsers.includes(data.author.login)) core.error("no need create RFC")
    
    let service
    let result = {}
    result.changes = []
    if(services.length > 1) {
        // xxx-yyy-v.1.2.3 -> xxxyyy
        service = data.tag_name.split("v")[0].replaceAll("-","")
        if (!services.includes(service)) core.setFailed("no need create RFC")
    } else {
        service = services[0]
    }

    let changes = data.body.split("* ")
    for (let i = 1; i < changes.length; i++) {
        result.changes.push(extractIssue(changes[i].replace(/[\r\n]/gm, '')))
    }

    result.body = data.body
    result.service = service
    result.tag = data.tag_name
    result.tagUrl = data.html_url
    result.pic = data.author.login
    result.status = "NEW"
    result.releaseHash = await getReleaseHash(result.tag)
    result.stableHash = await latestStableHash(result.tag)
    
    return result
}

function extractIssue(changes){
    const author = changes.match(/@\w*/g)[0].replace("@", "")
    const issue = changes.match(/\[(.*?)\]/)[0].replace(/[\[\]']+/g,'')
    return {changes, issue, author}
}

async function getReleaseHash(tag){
    const resp = await octokit.request('GET /repos/{owner}/{repo}/git/ref/tags/{tag_name}', {
        owner: owner,
        repo: repo,
        tag_name: tag
    })

    return resp.data.object.sha
}

// TODO: need improvement
function latestStableHash(currentTag){
    let splittedStr = currentTag.split(".")
    const stableMinorVersion = parseInt(splittedStr[splittedStr.length -1 ]) - 1
    splittedStr[splittedStr.length - 1] = stableMinorVersion.toString()
    return getReleaseHash(splittedStr.join("."))
}

function composeThread(data){
    const status = data.status
    const service = data.service
    const pic = member.getSlackFromGithub(data.pic)
    const tag = data.tag
    const release =  data.tagUrl
    const rfc = "-"

    const text = deployemntTemplate
        .replace('{rfc}', rfc)
        .replace('{service}', service)
        .replace('{pic}', `<@${pic}>`)
        .replace('{tag}', tag)
        .replace('{release}', release)

    const attachments = [
        {
            "color": "#00b200",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": "Status: " + status,
                        "emoji": true
                    }
                }
            ]
        }
    ]

    return {text, attachments}
}

function composeFeatureRelease(data){
    let text = `Release changes:\n`
    for (const change of data.changes){
        text += `\n • ${change.changes} (<@${member.getSlackFromGithub(change.author)}>)\n`
    }
    text = "```" + text + "```" 

    return text
}

main()