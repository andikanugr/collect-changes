exports.Member=function(accounts){
    this.githubToSlack = {}
    this.slackToGithub = {}
    this.githubToJira = {}


    for (const account of accounts){
        this.githubToJira[account[0]] = account[2]
        this.githubToSlack[account[0]] = account[1]
        this.slackToGithub[account[1]] = account[0]
    }

    this.getSlackFromGithub = function(gh) {
        return this.githubToSlack[gh]
    }

    this.getJiraFromGithub = function(gh) {
        return this.githubToJira[gh]
    }

    this.getGithubFromSlack = function(s) {
        return this.slackToGithub[s]
    }
}