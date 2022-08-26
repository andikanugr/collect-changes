const { App } = require('@slack/bolt');

exports.Slack = function(token, secret){
    this.app = new App({
        token: token,
        signingSecret: secret
    })

    this.replyThread = async function(channel, ts, message) {
        await this.app.client.chat.postMessage({
            channel: channel,
            thread_ts: ts,
            text: message
        })
    }

    this.sendMessageToChannel = async function(channel, message){
        const result = await this.app.client.chat.postMessage({
            channel: channel,
            text: message
        })
        return result.ts
    }
    
    this.sendMessageWithAttachmentsToChannel = async function (channel, message, attachments){
        const result = await this.app.client.chat.postMessage({
            channel: channel,
            attachments: attachments,
            text: message
        })
        return result.ts
    }
}
