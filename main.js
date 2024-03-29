const core = require('@actions/core');
const { Octokit } = require("@octokit/action");
const { Member, Slack, Sheet } = require("dg-action-tools");
const { context } = require("@actions/github");

const service = core.getInput('service')
const services = service.split(",")
const excludedUser = core.getInput('exclude')
const excludedUsers = excludedUser.split(",")
const slackChannel = core.getInput('slack_channel')
const sheetId = core.getInput('sheet_id')
const sheetLogGid = core.getInput('sheet_log_gid')

const slackToken = process.env.SLACK_BOT_TOKEN
const slackSecret = process.env.SLACK_BOT_SECRET
const keys = process.env.GOOGLE_ACCOUNT_KEY



const octokit = new Octokit();
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");


const slack = new Slack(slackToken, slackSecret)
const sheet = new Sheet(keys, sheetId)

const deployemntTemplate = `Deployment :fire:\n\nService: {service}\nPIC: {pic}\nRFC: {rfc}\nTag: {tag}\nRelease: {release}\nStatus: {status}`

async function main(){
    const tagName = context.ref;
    const tag = tagName.replace("refs/tags/", "");
    const releaseData = await extractReleaseData(tag)
    const userAccount = await sheet.batchGet("user mapping")
    const users = sheet.valueToArray(userAccount)
    const member = new Member(users)

    const {message, attachments} = composeThread(releaseData, member)
    const ts = await slack.sendMessageWithAttachmentsToChannel(slackChannel, message, attachments)
    releaseData.thread = ts
    const featureRelease = composeFeatureRelease(releaseData, member)
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
    deploymentLogObj.Thread = data.thread + ''
    deploymentLogObj.RFC = ''
    deploymentLogObj.Pipeline = ''
    deploymentLogObj.Status = data.status
    deploymentLogObj.Changes = JSON.stringify(data.changes)
    deploymentLogObj.Description = data.description

    let tasks = []
    let eic = []
    for(const change of data.changes){
        if(change.issue != null) {
            for (const task of change.issue.split(",")){
                tasks.push(task)
            }
            
        }
        if(change.author != null) eic.push(change.author)
    }
    deploymentLogObj.Tasks = tasks.toString()
    deploymentLogObj.EIC = [...new Set(eic)].toString()
    sheet.appendFirstRowWithObject("deployment log", sheetLogGid, deploymentLogObj)
}

async function getLatestRelease(tag){
    const resp = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
        owner: owner,
        repo: repo,
        tag: tag,
    })

    return resp.data
}

async function extractReleaseData(tag){
    const data = await getLatestRelease(tag)
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

    result.description = data.body
    result.service = service
    result.tag = data.tag_name
    result.tagUrl = data.html_url
    
    result.status = "NEW"
    result.releaseHash = await getReleaseHash(result.tag)
    result.stableHash = await latestStableHash(result.tag)

    const pic = await getWorkwflowActor(result.tag)
    result.pic = pic ? pic : data.author.login
    
    return result
}

function extractIssue(changes){
    const author = changes.match(/@([a-z0-9](?:-(?=[a-z0-9])|[a-z0-9]){0,38}(?<=[a-z0-9]))/gi) != null ? changes.match(/@([a-z0-9](?:-(?=[a-z0-9])|[a-z0-9]){0,38}(?<=[a-z0-9]))/gi)[0].replace("@", "") : null
    const issue = changes.match(/\[(.*?)\]/) != null ? changes.match(/\[(.*?)\]/)[0].replace(/[\[\]']+/g,'') : null
    if(issue == ""){
        issue = null
    }
    return {changes, issue, author}
}

async function getReleaseHash(tag){
    const resp = await octokit.request('GET /repos/{owner}/{repo}/git/ref/tags/{tag_name}', {
        owner: owner,
        repo: repo,
        tag_name: tag
    })

    return `${tag} (${resp.data.object.sha})`
}

// TODO: need improvement
function latestStableHash(currentTag){
    let splittedStr = currentTag.split(".")
    if(parseInt(splittedStr[splittedStr.length -1 ]) != 0){
        const stableMinorVersion = parseInt(splittedStr[splittedStr.length -1 ]) - 1
        splittedStr[splittedStr.length - 1] = stableMinorVersion.toString()
    }else{
        const stableMajorVersion = parseInt(splittedStr[splittedStr.length - 2 ]) - 1
        splittedStr[splittedStr.length - 2] = stableMajorVersion.toString()
        splittedStr[splittedStr.length - 1] = "99"
    }
    
    return getReleaseHash(splittedStr.join("."))
}

function composeThread(data, member){
    const status = data.status
    const service = data.service
    const pic = member.getSlackFromGithub(data.pic)
    const tag = data.tag
    const release =  data.tagUrl
    const rfc = "-"

    const message = deployemntTemplate
        .replace('{rfc}', rfc)
        .replace('{service}', service)
        .replace('{pic}', `<@${pic}>`)
        .replace('{tag}', tag)
        .replace('{release}', release)
        .replace('{status}', status)

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

    return {message, attachments}
}

function composeFeatureRelease(data,member){
    let text = `Release changes:\n`
    for (const change of data.changes){
        text += `\n • ${change.changes} (<@${member.getSlackFromGithub(change.author)}>)\n`
    }
    text = "```" + text + "```" 

    return text
}

async function getWorkwflowActor(tag){
    const resp = await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
        owner: owner,
        repo: repo,
        per_page: 50,
    })
    var filtered = resp.data.workflow_runs.filter(function(wf) {
        return wf.display_title == tag
      });
    
    if(filtered.length > 0){
        return filtered[0].actor.login
    }
    core.info(resp.data)
    return null
}

main()