const { App } = require('@slack/bolt');

exports.Slack = function (token, secret) {
    this.app = new App({
        token: token,
        signingSecret: secret
    })

    this.replyThread = async function (channel, ts, message) {
        await this.app.client.chat.postMessage({
            channel: channel,
            thread_ts: ts,
            text: message
        })
    }

    this.sendMessageToChannel = async function (channel, message) {
        const result = await this.app.client.chat.postMessage({
            channel: channel,
            text: message
        })
        return result.ts
    }

    this.sendMessageWithAttachmentsToChannel = async function (channel, message, attachments) {
        const result = await this.app.client.chat.postMessage({
            channel: channel,
            attachments: attachments,
            text: message
        })
        return result.ts
    }

    const deployemntTemplate = `Deployment :fire:\n\nService: {service}\nPIC: {pic}\nRFC: {rfc}\nTag: {tag}\nRelease: {release}`
    this.DGupdateDeploymentThread = async function (channel, ts, data) {
        const status = data.Status
        const service = data.Service
        const pic = data.PIC
        const tag = data.Tag
        const release = data.TagUrl
        const rfc = data.RFC

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

        const result = await this.app.client.chat.update({
            ts: ts,
            channel: channel,
            attachments: attachments,
            text: message
        })
        return result.ts
    }
}
